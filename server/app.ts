import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import { z } from "zod";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import PDFDocument from "pdfkit";
import {
  StoreDB,
  uid,
  now,
  day,
  event,
  amend,
  verifyAmendments,
} from "./store.js";
import { AuthProblem, AuthService } from "./auth.js";
import { MailDeliveryError, sendAuthCode } from "./mailer.js";
import { SimulationService } from "./simulator.js";
import {
  capabilities,
  draftWithBedrock,
  extractImage,
  mirrorEvidence,
} from "./aws.js";
import {
  FINANCIAL_CASE_FIELDS,
  type State,
  type RecoveryCase,
  type Draft,
  type Payment,
  type Lot,
  type Archivable,
  type AmendableCaseField,
} from "../shared/types.js";
import {
  canAccessCase,
  canAccessStore,
  hasCapability,
  type AuthUser,
  type Capability,
  type UserScopes,
} from "../shared/auth.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { user: AuthUser; sessionId: string };
    }
  }
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = status === 400 ? "INVALID_INPUT" : "REQUEST_FAILED",
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const text = z.string().trim().min(1).max(200);
const optional = z.string().trim().max(200).default("");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(value);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Use a valid date");
const money = z.number().int().positive().max(100_000_000_00);
const caseInput = z
  .object({
    title: text,
    kind: z.enum(["payment", "document", "dispute"]),
    counterparty: text,
    invoice: optional,
    amount: z.number().int().min(0).max(100_000_000_00),
    dueDate: isoDate,
    summary: z.string().trim().max(10000).default(""),
  })
  .refine(
    (value) =>
      value.kind === "payment" ? value.amount > 0 : value.amount === 0,
    "Payment cases need a positive amount; document and dispute cases use zero",
  );
const findCase = (s: State, id: string) =>
  s.cases.find((item) => item.id === id) || fail(404, "Case not found");
const outstanding = (s: State, c: RecoveryCase) =>
  c.amount -
  s.payments
    .filter((p) => p.caseId === c.id)
    .reduce((sum, p) => sum + p.amount, 0);
const rupees = (paise: number) =>
  `INR ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pathId = (req: Request) => String(req.params.id);

const filterState = (state: State, user: AuthUser): State => {
  const caseAccess = hasCapability(user, "view_cases");
  const inventoryAccess = hasCapability(user, "view_inventory");
  const activityAccess = hasCapability(user, "view_activity");
  const cases = caseAccess
    ? state.cases.filter((item) => canAccessCase(user, item.id))
    : [];
  const caseIds = new Set(cases.map((item) => item.id));
  const stores = inventoryAccess
    ? state.stores.filter((item) => canAccessStore(user, item.id))
    : [];
  const storeIds = new Set(stores.map((item) => item.id));
  const lots = inventoryAccess
    ? state.lots.filter((item) => storeIds.has(item.storeId))
    : [];
  const lotIds = new Set(lots.map((item) => item.id));
  const transfers = inventoryAccess
    ? state.transfers.filter(
        (item) => lotIds.has(item.lotId) || storeIds.has(item.destination),
      )
    : [];
  const entityIds = new Set([
    ...caseIds,
    ...storeIds,
    ...lotIds,
    ...transfers.map((item) => item.id),
  ]);
  return {
    ...state,
    cases,
    payments: state.payments.filter((item) => caseIds.has(item.caseId)),
    evidence: state.evidence.filter((item) => caseIds.has(item.caseId)),
    documents: state.documents.filter((item) => caseIds.has(item.caseId)),
    tasks: state.tasks.filter((item) => caseIds.has(item.caseId)),
    checklist: state.checklist.filter((item) => caseIds.has(item.caseId)),
    stores,
    lots,
    transfers,
    events: activityAccess
      ? state.events.filter(
          (item) =>
            entityIds.has(item.entityId) || user.role !== "recovery_operator",
        )
      : [],
    // Amendment history carries old field values, so it is scoped to the
    // records the caller may already see.
    amendments: state.amendments.filter(
      (item) =>
        (item.entityType === "case" && caseIds.has(item.entityId)) ||
        (item.entityType === "payment" &&
          state.payments.some(
            (payment) =>
              payment.id === item.entityId && caseIds.has(payment.caseId),
          )),
    ),
  };
};

function template(s: State, c: RecoveryCase, kind: string) {
  const intro = `Date: ${day()}\nFrom: ${s.workspace.name}\n${s.workspace.address}\n\nTo: ${c.counterparty}\nSubject: ${kind === "reminder" ? "Payment reminder" : kind === "request" ? "Recovery request" : "Statement of case"} - ${c.title}\n\n`;
  const body =
    c.kind === "payment"
      ? `Our records show invoice ${c.invoice || c.number} for ${rupees(c.amount)}, due on ${c.dueDate}. We have recorded ${rupees(c.amount - outstanding(s, c))} in payments, leaving ${rupees(outstanding(s, c))} outstanding.\n\nPlease arrange payment of the outstanding balance or share any discrepancy and supporting details so we can reconcile our records.`
      : `We are writing regarding ${c.title}.\n\n${c.summary || "Please review the supporting records attached to this request."}\n\nPlease confirm the requirements and next steps for resolving this matter.`;
  return `${intro}${body}\n\nSupporting records: ${
    s.evidence
      .filter((e) => e.caseId === c.id)
      .map((e) => e.name)
      .join(", ") || "None attached yet"
  }.\n\nRegards,\n${s.workspace.owner}\n${s.workspace.name}\n${s.workspace.email}\n\nDraft for owner review. No delivery or legal filing has been performed.`;
}

function pdf(
  res: Response,
  filename: string,
  render: (doc: PDFKit.PDFDocument) => void,
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: true,
    info: { Title: filename, Author: "ClaimChain" },
  });
  doc.pipe(res);
  doc.font(
    resolve(
      "node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff",
    ),
  );
  render(doc);
  const range = doc.bufferedPageRange();
  for (let page = 0; page < range.count; page++) {
    doc.switchToPage(page);
    doc
      .fontSize(8)
      .fillColor("#66736c")
      .text(
        `ClaimChain | Prepared ${day()} | Page ${page + 1} of ${range.count}`,
        48,
        795,
        { lineBreak: false },
      );
  }
  doc.end();
}

export function createApp(
  options: { directory?: string; seed?: boolean } = {},
) {
  const directory = resolve(
    options.directory || process.env.DATA_DIR || "data",
  );
  const db = new StoreDB(
    directory,
    options.seed ?? process.env.SEED_SAMPLE !== "false",
  );
  const auth = new AuthService(
    db.db,
    options.seed ?? process.env.SEED_SAMPLE !== "false",
  );
  const simulation = new SimulationService(db);
  const app = express();
  const cookieName = (
    process.env.AUTH_COOKIE_NAME || "claimchain_session"
  ).replace(/[^A-Za-z0-9_-]/g, "");
  const secure = process.env.AUTH_COOKIE_SECURE === "true";
  const cookie = (value: string, maxAge: number) =>
    `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  const tokenFrom = (req: Request) =>
    req.headers.cookie
      ?.split("; ")
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) || "";
  const requestMeta = (req: Request) => ({
    ip: req.ip || "local",
    userAgent: req.get("user-agent") || "",
  });
  const requireCapability =
    (capability: Capability) =>
    (req: Request, _res: Response, next: NextFunction) => {
      if (!req.auth || !hasCapability(req.auth.user, capability)) {
        if (req.auth)
          auth.audit({
            actor: req.auth.user,
            action: "Authorization denied",
            detail: `Missing ${capability} for ${req.method} ${req.path}`,
            ...requestMeta(req),
          });
        return next(
          new AuthProblem(
            403,
            "FORBIDDEN",
            "You do not have permission for this action",
          ),
        );
      }
      next();
    };
  const requireCase = (req: Request, caseId: string) => {
    if (!canAccessCase(req.auth!.user, caseId))
      throw new AuthProblem(
        403,
        "FORBIDDEN",
        "This case is outside your assignment",
      );
  };
  const requireStore = (req: Request, storeId: string) => {
    if (!canAccessStore(req.auth!.user, storeId))
      throw new AuthProblem(
        403,
        "FORBIDDEN",
        "This store is outside your assignment",
      );
  };
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        origin &&
        ![
          process.env.APP_ORIGIN,
          `http://${req.headers.host}`,
          `https://${req.headers.host}`,
          "http://127.0.0.1:5173",
          "http://localhost:5173",
        ]
          .filter(Boolean)
          .includes(origin)
      )
        return next(new HttpError(403, "Cross-origin request rejected"));
    }
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", authentication: true }),
  );
  app.post("/api/auth/login", (req, res) => {
    const input = z
      .object({
        identifier: z.string().trim().min(1).max(320),
        password: z.string().max(512),
      })
      .parse(req.body);
    const meta = requestMeta(req);
    auth.checkRate(`login:${meta.ip}`, 10);
    const user = auth.authenticate(input.identifier, input.password);
    if (!user) {
      auth.audit({
        actorLabel: input.identifier,
        action: "Login failed",
        detail: "Invalid credentials",
        ...meta,
      });
      throw new AuthProblem(
        401,
        "INVALID_CREDENTIALS",
        "The email, username, or password is incorrect",
      );
    }
    if (!user.active)
      throw new AuthProblem(
        403,
        "ACCOUNT_DISABLED",
        "This account has been disabled",
      );
    if (!user.verified)
      throw new AuthProblem(
        403,
        "VERIFICATION_REQUIRED",
        "Verify your email before signing in",
      );
    const session = auth.createSession(user.id, meta);
    auth.audit({
      actor: user,
      targetId: user.id,
      action: "Login succeeded",
      detail: "Session issued",
      ...meta,
    });
    res.setHeader(
      "Set-Cookie",
      cookie(
        session.token,
        Math.max(
          1,
          Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000),
        ),
      ),
    );
    res.json({ user: auth.getUser(user.id) });
  });
  app.get("/api/auth/me", (req, res) => {
    const session = auth.resolveSession(tokenFrom(req));
    if (!session)
      throw new AuthProblem(401, "UNAUTHENTICATED", "Sign in to continue");
    res.json({ user: session.user });
  });
  app.post("/api/auth/logout", (req, res) => {
    const session = auth.resolveSession(tokenFrom(req));
    if (session) {
      auth.revokeSession(session.sessionId);
      auth.audit({
        actor: session.user,
        targetId: session.user.id,
        action: "Logout",
        detail: "Session revoked",
        ...requestMeta(req),
      });
    }
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  app.post("/api/auth/verify/send", async (req, res) => {
    const identifier = z
      .object({ identifier: z.string().trim().min(1).max(320) })
      .parse(req.body).identifier;
    const meta = requestMeta(req);
    auth.checkRate(`verify:${meta.ip}:${identifier.toLowerCase()}`);
    const user = auth.identifierUser(identifier);
    if (!user || !user.active || user.verified)
      return res.json({
        ok: true,
        message: "If verification is required, a code has been sent.",
      });
    const code = auth.createCode("verification", user.id);
    await sendAuthCode({
      email: user.email,
      displayName: user.displayName,
      code: code.code,
      type: "verification",
    });
    auth.audit({
      actorLabel: identifier,
      targetId: user.id,
      action: "Verification requested",
      detail: "Verification code issued",
      ...meta,
    });
    res.json({
      ok: true,
      message: "If verification is required, a code has been sent.",
      ...auth.exposeCode(code),
    });
  });
  app.post("/api/auth/verify/confirm", (req, res) => {
    const input = z
      .object({
        identifier: z.string().trim().min(1),
        requestId: z.uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(req.body);
    const userId = auth.consumeCode(
      "verification",
      input.requestId,
      input.code,
    );
    const user = auth.identifierUser(input.identifier);
    if (!user || user.id !== userId)
      throw new AuthProblem(
        400,
        "INVALID_CODE",
        "The verification request does not match this account",
      );
    const verified = auth.markVerified(userId);
    auth.audit({
      actor: verified,
      targetId: userId,
      action: "Email verified",
      detail: "Verification completed",
      ...requestMeta(req),
    });
    res.json({ ok: true });
  });
  app.post("/api/auth/forgot", async (req, res) => {
    const identifier = z
      .object({ identifier: z.string().trim().min(1).max(320) })
      .parse(req.body).identifier;
    const meta = requestMeta(req);
    auth.checkRate(`reset:${meta.ip}:${identifier.toLowerCase()}`);
    const user = auth.identifierUser(identifier);
    const generic = {
      ok: true,
      message: "If the account can be recovered, a reset code has been sent.",
    };
    if (!user || !user.active || !user.verified) return res.json(generic);
    const code = auth.createCode("reset", user.id);
    await sendAuthCode({
      email: user.email,
      displayName: user.displayName,
      code: code.code,
      type: "reset",
    });
    auth.audit({
      actorLabel: identifier,
      targetId: user.id,
      action: "Password reset requested",
      detail: "Reset code issued",
      ...meta,
    });
    res.json({ ...generic, ...auth.exposeCode(code) });
  });
  app.post("/api/auth/reset", (req, res) => {
    const input = z
      .object({
        requestId: z.uuid(),
        code: z.string().regex(/^\d{6}$/),
        password: z.string().max(512),
      })
      .parse(req.body);
    const userId = auth.consumeCode("reset", input.requestId, input.code);
    auth.resetPassword(userId, input.password);
    const user = auth.getUser(userId)!;
    auth.audit({
      actor: user,
      targetId: userId,
      action: "Password reset completed",
      detail: "All sessions revoked",
      ...requestMeta(req),
    });
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  app.use("/api", (req, _res, next) => {
    const session = auth.resolveSession(tokenFrom(req));
    if (!session)
      return next(
        new AuthProblem(401, "UNAUTHENTICATED", "Sign in to continue"),
      );
    req.auth = session;
    next();
  });
  const paging = (req: Request) => ({
    page: Math.max(1, Math.floor(Number(req.query.page) || 1)),
    pageSize: Math.min(
      50,
      Math.max(5, Math.floor(Number(req.query.pageSize) || 10)),
    ),
  });
  const scopeSchema = z
    .object({
      caseIds: z.array(z.string().min(1)).default([]),
      storeIds: z.array(z.string().min(1)).default([]),
    })
    .strict();
  const validateScopes = (scopes: UserScopes) => {
    const state = db.read();
    const caseIds = new Set(state.cases.map((item) => item.id));
    const storeIds = new Set(state.stores.map((item) => item.id));
    if (scopes.caseIds.some((id) => !caseIds.has(id)))
      throw new AuthProblem(
        400,
        "INVALID_INPUT",
        "One or more assigned cases do not exist",
      );
    if (scopes.storeIds.some((id) => !storeIds.has(id)))
      throw new AuthProblem(
        400,
        "INVALID_INPUT",
        "One or more assigned stores do not exist",
      );
    return {
      caseIds: [...new Set(scopes.caseIds)],
      storeIds: [...new Set(scopes.storeIds)],
    };
  };
  app.get("/api/admin/roles", requireCapability("manage_users"), (_req, res) =>
    res.json({ roles: auth.roles() }),
  );
  app.get("/api/admin/users", requireCapability("manage_users"), (req, res) => {
    const { page, pageSize } = paging(req);
    res.json(auth.listUsers(page, pageSize, String(req.query.q || "")));
  });
  app.post(
    "/api/admin/users",
    requireCapability("manage_users"),
    (req, res) => {
      const input = z
        .object({
          username: z.string().trim().min(3).max(80),
          email: z.email(),
          displayName: text,
          role: z.string(),
          password: z.string().max(512),
          scopes: scopeSchema.default({ caseIds: [], storeIds: [] }),
        })
        .strict()
        .parse(req.body);
      const user = auth.createUser({
        ...input,
        scopes: validateScopes(input.scopes),
      });
      auth.audit({
        actor: req.auth!.user,
        targetId: user.id,
        action: "Account provisioned",
        detail: `${user.username} as ${user.role}; verification required`,
        ...requestMeta(req),
      });
      res.status(201).json(user);
    },
  );
  app.patch(
    "/api/admin/users/:id",
    requireCapability("manage_users"),
    (req, res) => {
      const input = z
        .object({
          username: z.string().trim().min(3).max(80).optional(),
          email: z.email().optional(),
          displayName: text.optional(),
          role: z.string().optional(),
          active: z.boolean().optional(),
          verified: z.boolean().optional(),
          scopes: scopeSchema.optional(),
          password: z.string().max(512).optional(),
        })
        .strict()
        .parse(req.body);
      const user = auth.updateUser(pathId(req), {
        ...input,
        scopes: input.scopes ? validateScopes(input.scopes) : undefined,
      });
      auth.audit({
        actor: req.auth!.user,
        targetId: user.id,
        action: "Account updated",
        detail: `${user.username}; role ${user.role}; ${user.active ? "active" : "disabled"}`,
        ...requestMeta(req),
      });
      res.json(user);
    },
  );
  app.delete(
    "/api/admin/users/:id",
    requireCapability("manage_users"),
    (req, res) => {
      const target = auth.getUser(pathId(req));
      auth.deleteUser(pathId(req), req.auth!.user.id);
      auth.audit({
        actor: req.auth!.user,
        targetId: pathId(req),
        action: "Account deleted",
        detail: target?.username || "Deleted account",
        ...requestMeta(req),
      });
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/admin/users/:id/resend-verification",
    requireCapability("manage_users"),
    async (req, res) => {
      const user = auth.getUser(pathId(req));
      if (!user)
        throw new AuthProblem(404, "USER_NOT_FOUND", "Account not found");
      if (user.verified)
        return res.json({ ok: true, message: "Account is already verified" });
      const code = auth.createCode("verification", user.id);
      await sendAuthCode({
        email: user.email,
        displayName: user.displayName,
        code: code.code,
        type: "verification",
      });
      auth.audit({
        actor: req.auth!.user,
        targetId: user.id,
        action: "Verification resent",
        detail: user.username,
        ...requestMeta(req),
      });
      res.json({ ok: true, ...auth.exposeCode(code) });
    },
  );
  app.get(
    "/api/admin/security-audit",
    requireCapability("manage_users"),
    (req, res) => {
      const { page, pageSize } = paging(req);
      res.json(auth.listAudit(page, pageSize));
    },
  );
  app.get(
    "/api/simulation/status",
    requireCapability("manage_simulation"),
    (_req, res) => res.json(simulation.status()),
  );
  app.post(
    "/api/simulation/ingest",
    requireCapability("manage_simulation"),
    (req, res) => {
      const result = simulation.ingest();
      auth.audit({
        actor: req.auth!.user,
        action: "Simulation event ingested",
        detail: result.message,
        ...requestMeta(req),
      });
      res.status(201).json(result);
    },
  );
  app.get("/api/bootstrap", requireCapability("view_dashboard"), (req, res) =>
    res.json({
      ...filterState(db.read(), req.auth!.user),
      capabilities: { ...capabilities(), auth: true },
    }),
  );
  app.get("/api/export", requireCapability("manage_workspace"), (_req, res) => {
    res
      .attachment(`claimchain-workspace-${day()}.json`)
      .json({ exportedAt: now(), schemaVersion: 1, ...db.read() });
  });
  app.patch(
    "/api/workspace",
    requireCapability("manage_workspace"),
    (req, res) => {
      const input = z
        .object({
          name: text,
          owner: text,
          email: z.email(),
          address: z.string().trim().max(500),
        })
        .parse(req.body);
      res.json(
        db.mutate((s) => {
          Object.assign(s.workspace, input);
          event(s, "workspace", "workspace", "Workspace updated", input.name);
          return s.workspace;
        }),
      );
    },
  );
  app.post("/api/cases", requireCapability("create_cases"), (req, res) => {
    const input = caseInput.parse(req.body);
    res.status(201).json(
      db.mutate((s) => {
        const c: RecoveryCase = {
          ...input,
          id: uid(),
          number: `CC-${1041 + s.cases.length}`,
          status: "open",
          createdAt: now(),
        };
        s.cases.unshift(c);
        if (c.kind !== "payment")
          [
            "Identity or business proof",
            "Supporting records collected",
            "Request reviewed",
            "Replacement or resolution confirmed",
          ].forEach((label) =>
            s.checklist.push({ id: uid(), caseId: c.id, label, done: false }),
          );
        event(s, c.id, "case", "Case opened", `${c.counterparty}: ${c.title}`);
        return c;
      }),
    );
  });
  app.get("/api/cases/:id", requireCapability("view_cases"), (req, res) => {
    const s = db.read(),
      c = findCase(s, pathId(req));
    requireCase(req, c.id);
    res.json({
      ...c,
      payments: s.payments.filter((p) => p.caseId === c.id),
      evidence: s.evidence.filter((e) => e.caseId === c.id),
      documents: s.documents.filter((d) => d.caseId === c.id),
      tasks: s.tasks.filter((t) => t.caseId === c.id),
      checklist: s.checklist.filter((t) => t.caseId === c.id),
      events: s.events.filter((e) => e.entityId === c.id),
      amendments: s.amendments.filter(
        (a) =>
          (a.entityType === "case" && a.entityId === c.id) ||
          (a.entityType === "payment" &&
            s.payments.some((p) => p.id === a.entityId && p.caseId === c.id)),
      ),
    });
  });
  app.patch("/api/cases/:id", requireCapability("manage_cases"), (req, res) => {
    const input = z
      .object({
        summary: z.string().trim().max(10000).optional(),
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
      })
      .parse(req.body);
    res.json(
      db.mutate((s) => {
        const c = findCase(s, pathId(req));
        requireCase(req, c.id);
        if (input.status === "resolved") {
          if (c.kind === "payment" && outstanding(s, c) !== 0)
            fail(
              409,
              "Record the remaining payment before resolving this case",
            );
          if (
            c.kind !== "payment" &&
            s.checklist.some((i) => i.caseId === c.id && !i.done)
          )
            fail(
              409,
              "Complete every recovery requirement before resolving this case",
            );
        }
        if (
          c.kind === "payment" &&
          c.status === "resolved" &&
          input.status &&
          input.status !== "resolved"
        )
          fail(409, "A fully paid case remains resolved");
        Object.assign(c, input);
        event(
          s,
          c.id,
          "case",
          "Case updated",
          input.status
            ? `Status changed to ${input.status.replace("_", " ")}`
            : "Case summary updated",
        );
        return c;
      }),
    );
  });
  app.post(
    "/api/cases/:id/payments",
    requireCapability("record_payments"),
    (req, res) => {
      const input = z
        .object({
          amount: money,
          date: isoDate,
          reference: text,
          key: z.string().min(8).max(100),
        })
        .parse(req.body);
      if (input.date > day()) fail(400, "Payment date cannot be in the future");
      res.status(201).json(
        db.mutate((s) => {
          const c = findCase(s, pathId(req));
          requireCase(req, c.id);
          if (c.archivedAt)
            fail(409, "Restore this case before recording payments");
          if (c.kind !== "payment")
            fail(409, "Payments belong to payment recovery cases");
          const duplicate = s.payments.find(
            (p) => p.caseId === c.id && p.key === input.key,
          );
          if (duplicate) {
            if (
              duplicate.amount !== input.amount ||
              duplicate.date !== input.date ||
              duplicate.reference !== input.reference
            )
              fail(
                409,
                "This payment key was used for different payment details",
              );
            return duplicate;
          }
          // A reference is only taken by a live original. Once an entry has
          // been reversed the same bank reference can be recorded again with
          // the corrected amount, which is the whole point of a reversal.
          if (
            s.payments.some(
              (p) =>
                p.caseId === c.id &&
                !p.reversalOf &&
                !p.reversedBy &&
                p.reference.toLowerCase() === input.reference.toLowerCase(),
            )
          )
            fail(409, "A payment with this reference already exists");
          if (input.amount > outstanding(s, c))
            fail(409, "Payment exceeds the outstanding balance");
          const p = { ...input, id: uid(), caseId: c.id, createdAt: now() };
          s.payments.push(p);
          c.status = outstanding(s, c) === 0 ? "resolved" : "in_progress";
          event(
            s,
            c.id,
            "case",
            "Payment recorded",
            `${rupees(p.amount)} - ${p.reference} (owner recorded)`,
          );
          return p;
        }),
      );
    },
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/cases/:id/evidence",
    requireCapability("manage_evidence"),
    upload.single("file"),
    (req, res) => {
      const file = req.file;
      if (!file) fail(400, "Choose an evidence file");
      const f = file!;
      if (
        !["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(
          f.mimetype,
        )
      )
        fail(400, "Use a PDF, PNG, JPEG or plain text file");
      if (f.size === 0) fail(400, "The file is empty");
      const signatureOK =
        f.mimetype === "text/plain"
          ? !f.buffer.includes(0)
          : f.mimetype === "application/pdf"
            ? f.buffer.subarray(0, 5).toString() === "%PDF-"
            : f.mimetype === "image/png"
              ? f.buffer
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : f.buffer[0] === 255 &&
                f.buffer[1] === 216 &&
                f.buffer[2] === 255;
      if (!signatureOK) fail(400, "The file contents do not match its type");
      const digest = createHash("sha256").update(f.buffer).digest("hex");
      const id = uid();
      let createdPath: string | undefined;
      try {
        const result = db.mutate((s) => {
          const c = findCase(s, pathId(req));
          requireCase(req, c.id);
          if (c.archivedAt)
            fail(409, "Restore this case before attaching evidence");
          const duplicate = s.evidence.find(
            (e) => e.caseId === c.id && e.digest === digest,
          );
          if (duplicate) return duplicate;
          createdPath = join(directory, "evidence", id);
          writeFileSync(createdPath, f.buffer, { flag: "wx" });
          const record = {
            id,
            caseId: c.id,
            name: f.originalname.replace(/[\x00-\x1f]/g, "").slice(0, 200),
            mime: f.mimetype,
            size: f.size,
            digest,
            text:
              f.mimetype === "text/plain"
                ? f.buffer.toString("utf8").slice(0, 100000)
                : "",
            provider:
              f.mimetype === "text/plain" ? "Local text" : "Not extracted",
            createdAt: now(),
          };
          s.evidence.push(record);
          event(s, c.id, "case", "Evidence added", record.name);
          return record;
        });
        res.status(201).json(result);
      } catch (error) {
        if (createdPath && existsSync(createdPath)) unlinkSync(createdPath);
        throw error;
      }
    },
  );
  app.get(
    "/api/evidence/:id/file",
    requireCapability("view_cases"),
    (req, res) => {
      const e =
        db.read().evidence.find((e) => e.id === pathId(req)) ||
        fail(404, "Evidence not found");
      requireCase(req, e.caseId);
      res.type(e.mime).download(join(directory, "evidence", e.id), e.name);
    },
  );
  app.post(
    "/api/evidence/:id/extract",
    requireCapability("manage_evidence"),
    async (req, res) => {
      const e =
        db.read().evidence.find((e) => e.id === pathId(req)) ||
        fail(404, "Evidence not found");
      requireCase(req, e.caseId);
      if (e.mime === "text/plain") return res.json(e);
      if (!capabilities().textract)
        fail(
          409,
          "Textract is not configured. Plain text evidence is readable locally.",
        );
      if (!["image/png", "image/jpeg"].includes(e.mime))
        fail(
          400,
          "This extraction path accepts PNG and JPEG images. Upload image pages for scanned PDFs.",
        );
      if (e.size > 5 * 1024 * 1024)
        fail(400, "Textract image extraction requires a file of 5 MB or less");
      const extracted = await extractImage(
        readFileSync(join(directory, "evidence", e.id)),
      );
      res.json(
        db.mutate((s) => {
          const item = s.evidence.find((x) => x.id === e.id)!;
          item.text = extracted;
          item.provider = "AWS Textract";
          event(
            s,
            e.caseId,
            "case",
            "Evidence extracted",
            `${e.name} - review extracted text`,
          );
          return item;
        }),
      );
    },
  );
  app.post(
    "/api/evidence/:id/mirror",
    requireCapability("manage_evidence"),
    async (req, res) => {
      if (!capabilities().s3) fail(409, "S3 is not configured");
      const e =
        db.read().evidence.find((e) => e.id === pathId(req)) ||
        fail(404, "Evidence not found");
      requireCase(req, e.caseId);
      const key = `evidence/${e.caseId}/${e.id}`;
      await mirrorEvidence(
        key,
        readFileSync(join(directory, "evidence", e.id)),
        e.mime,
        e.digest,
      );
      res.json(
        db.mutate((s) => {
          const item = s.evidence.find((x) => x.id === e.id)!;
          item.cloudKey = key;
          event(
            s,
            e.caseId,
            "case",
            "Evidence mirrored",
            `${e.name} stored in private S3`,
          );
          return item;
        }),
      );
    },
  );
  app.post(
    "/api/cases/:id/documents",
    requireCapability("prepare_documents"),
    async (req, res) => {
      const input = z
        .object({
          kind: z.enum(["reminder", "request", "statement"]),
          ai: z.boolean().default(false),
        })
        .parse(req.body);
      const snapshot = db.read(),
        c = findCase(snapshot, pathId(req));
      requireCase(req, c.id);
      if (c.archivedAt) fail(409, "Restore this case before preparing a draft");
      if (input.ai && !capabilities().bedrock)
        fail(409, "Bedrock is not configured");
      const body = input.ai
        ? await draftWithBedrock(
            JSON.stringify({
              case: c,
              outstanding: rupees(outstanding(snapshot, c)),
              workspace: snapshot.workspace,
              evidence: snapshot.evidence
                .filter((e) => e.caseId === c.id)
                .map((e) => ({ name: e.name, text: e.text.slice(0, 8000) })),
            }),
          )
        : template(snapshot, c, input.kind);
      res.status(201).json(
        db.mutate((s) => {
          const current = findCase(s, c.id);
          const d: Draft = {
            id: uid(),
            caseId: c.id,
            kind: input.kind,
            title: `${input.kind === "reminder" ? "Payment reminder" : input.kind === "request" ? "Recovery request" : "Case statement"} - ${c.number}`,
            body,
            revision: 1,
            createdAt: now(),
            updatedAt: now(),
            provider: input.ai
              ? "Amazon Bedrock - review required"
              : "Local template",
          };
          s.documents.unshift(d);
          if (current.status === "open") current.status = "in_progress";
          event(s, c.id, "case", "Draft prepared", `${d.title} (not sent)`);
          return d;
        }),
      );
    },
  );
  app.patch(
    "/api/documents/:id",
    requireCapability("prepare_documents"),
    (req, res) => {
      const input = z
        .object({
          body: z.string().trim().min(1).max(30000),
          revision: z.number().int().positive(),
        })
        .parse(req.body);
      res.json(
        db.mutate((s) => {
          const d =
            s.documents.find((d) => d.id === pathId(req)) ||
            fail(404, "Draft not found");
          requireCase(req, d.caseId);
          if (input.revision !== d.revision)
            fail(
              409,
              "This draft changed elsewhere. Reopen it before editing.",
            );
          d.body = input.body;
          d.revision++;
          d.updatedAt = now();
          event(
            s,
            d.caseId,
            "case",
            "Draft revised",
            `${d.title}, revision ${d.revision}`,
          );
          return d;
        }),
      );
    },
  );
  app.get(
    "/api/documents/:id/download",
    requireCapability("view_cases"),
    (req, res) => {
      const d =
        db.read().documents.find((d) => d.id === pathId(req)) ||
        fail(404, "Draft not found");
      requireCase(req, d.caseId);
      pdf(res, "claimchain-letter.pdf", (doc) => {
        doc.fontSize(20).fillColor("#167451").text("ClaimChain");
        doc
          .moveDown()
          .fontSize(11)
          .fillColor("#202823")
          .text(d.body, { lineGap: 5 });
      });
    },
  );
  app.get(
    "/api/cases/:id/packet",
    requireCapability("export_packets"),
    (req, res) => {
      const s = db.read(),
        c = findCase(s, pathId(req));
      requireCase(req, c.id);
      pdf(res, `${c.number}-case-packet.pdf`, (doc) => {
        doc
          .fontSize(11)
          .fillColor("#167451")
          .text("CLAIMCHAIN / RECOVERY PACKET");
        doc.moveDown().fontSize(24).fillColor("#202823").text(c.title);
        doc
          .moveDown()
          .fontSize(11)
          .text(
            `${c.number} | ${c.counterparty}\nStatus: ${c.status.replace("_", " ")}\nDue: ${c.dueDate}`,
          );
        if (c.kind === "payment")
          doc
            .moveDown()
            .text(
              `Principal: ${rupees(c.amount)}\nOutstanding: ${rupees(outstanding(s, c))}`,
            );
        doc.moveDown().text(c.summary || "No summary recorded.");
        const section = (title: string) => {
          doc.moveDown().fontSize(15).fillColor("#167451").text(title);
          doc.moveDown(0.4).fontSize(10).fillColor("#202823");
        };
        section("Payment ledger");
        const payments = s.payments.filter((p) => p.caseId === c.id);
        if (!payments.length) doc.text("No payments recorded.");
        payments.forEach((p) =>
          doc.text(
            `${p.date} | ${rupees(p.amount)} | ${p.reference} | ${
              p.reversalOf
                ? `Correcting entry - ${p.reason || "reversal"}`
                : p.reversedBy
                  ? "Owner recorded, later reversed"
                  : "Owner recorded"
            }`,
          ),
        );
        section("Evidence manifest");
        const evidence = s.evidence.filter((e) => e.caseId === c.id);
        if (!evidence.length) doc.text("No evidence attached.");
        evidence.forEach((e) => {
          doc.text(`${e.name} (${e.size} bytes)`);
          doc.fontSize(8).text(`SHA-256: ${e.digest}`);
          doc.fontSize(10).text(`Extraction: ${e.provider}`);
          if (e.text) doc.text(e.text.slice(0, 10000));
          doc.moveDown();
        });
        section("Recovery requirements");
        s.checklist
          .filter((i) => i.caseId === c.id)
          .forEach((i) =>
            doc.text(`${i.done ? "[Complete]" : "[Pending]"} ${i.label}`),
          );
        section("Corrections and amendments");
        const amendments = s.amendments.filter(
          (a) =>
            (a.entityType === "case" && a.entityId === c.id) ||
            (a.entityType === "payment" &&
              s.payments.some((p) => p.id === a.entityId && p.caseId === c.id)),
        );
        if (!amendments.length)
          doc.text("No recorded fact on this case has been amended.");
        amendments.forEach((a) => {
          doc.text(
            `${a.createdAt.slice(0, 10)} | ${a.field}: "${a.from}" changed to "${a.to}"`,
          );
          doc.text(
            `${
              a.kind === "correction"
                ? "Correction of a recording error"
                : "Change agreed with the counterparty"
            } by ${a.actorLabel}. Reason: ${a.reason}`,
          );
          doc.fontSize(8).text(`Chain digest: ${a.digest}`);
          doc.fontSize(10).moveDown(0.3);
        });
        section("Timeline");
        s.events
          .filter((e) => e.entityId === c.id)
          .slice()
          .reverse()
          .forEach((e) =>
            doc.text(`${e.createdAt.slice(0, 10)} | ${e.action}: ${e.detail}`, {
              paragraphGap: 5,
            }),
          );
        s.documents
          .filter((d) => d.caseId === c.id)
          .forEach((d) => {
            doc.addPage();
            section(`${d.title} / revision ${d.revision}`);
            doc.text(d.body, { lineGap: 4 });
          });
        section("Packet scope");
        doc.text(
          "Contains recorded facts, evidence manifest, extracted text, prepared drafts and every amendment made to this case. Original files are downloaded separately. Owner-recorded payments are not bank verified. A reversed payment is retained beside its correcting entry rather than removed. Amendment digests chain each entry to the one before it, which detects a silently altered history but is not an independently notarised timestamp. Hashes identify file bytes, not authenticity. No correspondence has been sent and no legal filing has been made by this export.",
        );
      });
    },
  );
  app.post("/api/tasks", requireCapability("manage_tasks"), (req, res) => {
    const input = z
      .object({ caseId: text, title: text, dueDate: isoDate })
      .parse(req.body);
    res.status(201).json(
      db.mutate((s) => {
        const owner = findCase(s, input.caseId);
        requireCase(req, input.caseId);
        if (owner.archivedAt)
          fail(409, "Restore this case before scheduling follow-ups");
        const task = { ...input, id: uid(), completedAt: null };
        s.tasks.push(task);
        event(
          s,
          input.caseId,
          "case",
          "Follow-up scheduled",
          `${input.title} - ${input.dueDate}`,
        );
        return task;
      }),
    );
  });
  app.patch("/api/tasks/:id", requireCapability("manage_tasks"), (req, res) => {
    const input = z.object({ done: z.boolean() }).parse(req.body);
    res.json(
      db.mutate((s) => {
        const task =
          s.tasks.find((t) => t.id === pathId(req)) ||
          fail(404, "Task not found");
        requireCase(req, task.caseId);
        if (Boolean(task.completedAt) !== input.done) {
          task.completedAt = input.done ? now() : null;
          event(
            s,
            task.caseId,
            "case",
            input.done ? "Follow-up completed" : "Follow-up reopened",
            task.title,
          );
        }
        return task;
      }),
    );
  });
  app.patch(
    "/api/checklist/:id",
    requireCapability("manage_cases"),
    (req, res) => {
      const input = z.object({ done: z.boolean() }).parse(req.body);
      res.json(
        db.mutate((s) => {
          const item =
            s.checklist.find((i) => i.id === pathId(req)) ||
            fail(404, "Requirement not found");
          const c = findCase(s, item.caseId);
          requireCase(req, c.id);
          if (c.archivedAt)
            fail(409, "Restore this case before changing its requirements");
          if (!input.done && c.status === "resolved")
            fail(409, "Reopen the case before changing completed requirements");
          if (item.done !== input.done) {
            item.done = input.done;
            event(
              s,
              item.caseId,
              "case",
              "Requirement updated",
              `${item.label}: ${item.done ? "complete" : "pending"}`,
            );
          }
          return item;
        }),
      );
    },
  );
  app.post("/api/stores", requireCapability("manage_workspace"), (req, res) => {
    const input = z.object({ name: text, locality: text }).parse(req.body);
    res.status(201).json(
      db.mutate((s) => {
        if (
          s.stores.some(
            (store) =>
              store.name.toLowerCase() === input.name.toLowerCase() &&
              store.locality.toLowerCase() === input.locality.toLowerCase(),
          )
        )
          fail(409, "This store already exists");
        const store = { ...input, id: uid() };
        s.stores.push(store);
        event(
          s,
          store.id,
          "store",
          "Store added",
          `${store.name}, ${store.locality}`,
        );
        return store;
      }),
    );
  });
  app.post("/api/stock", requireCapability("manage_inventory"), (req, res) => {
    const input = z
      .object({
        storeId: text,
        sku: text,
        product: text,
        category: text,
        unit: text,
        quantity: z.number().int().positive().max(1000000),
        expiry: isoDate,
        batch: text,
      })
      .parse(req.body);
    if (input.expiry < day()) fail(400, "Cannot add expired stock");
    requireStore(req, input.storeId);
    res.status(201).json(
      db.mutate((s) => {
        if (
          !s.stores.some(
            (store) => store.id === input.storeId && !store.archivedAt,
          )
        )
          fail(404, "Store not found");
        const existing = s.lots.find(
          (l) =>
            l.storeId === input.storeId &&
            l.sku === input.sku &&
            l.batch === input.batch,
        );
        if (existing)
          fail(409, "This SKU and batch already exists in this store");
        const lot = { ...input, id: uid(), reserved: 0 };
        s.lots.push(lot);
        event(
          s,
          lot.id,
          "stock",
          "Stock listed",
          `${lot.quantity} ${lot.unit} of ${lot.product}`,
        );
        return lot;
      }),
    );
  });
  app.post(
    "/api/transfers",
    requireCapability("manage_inventory"),
    (req, res) => {
      const input = z
        .object({
          lotId: text,
          destination: text,
          quantity: z.number().int().positive().max(1000000),
        })
        .parse(req.body);
      res.status(201).json(
        db.mutate((s) => {
          const lot =
            s.lots.find((l) => l.id === input.lotId) ||
            fail(404, "Stock lot not found");
          requireStore(req, lot.storeId);
          requireStore(req, input.destination);
          if (lot.archivedAt)
            fail(409, "This stock lot is archived. Restore it to transfer.");
          if (
            !s.stores.some(
              (store) => store.id === input.destination && !store.archivedAt,
            )
          )
            fail(404, "Destination store not found");
          if (lot.storeId === input.destination)
            fail(400, "Choose a different destination store");
          if (lot.expiry < day())
            fail(409, "Expired stock cannot be transferred");
          if (input.quantity > lot.quantity - lot.reserved)
            fail(409, "Not enough available stock");
          lot.reserved += input.quantity;
          const transfer = {
            ...input,
            id: uid(),
            status: "reserved" as const,
            createdAt: now(),
            updatedAt: now(),
          };
          s.transfers.unshift(transfer);
          event(
            s,
            transfer.id,
            "transfer",
            "Stock reserved",
            `${input.quantity} ${lot.unit} of ${lot.product}`,
          );
          return transfer;
        }),
      );
    },
  );
  app.post(
    "/api/transfers/:id/transition",
    requireCapability("manage_inventory"),
    (req, res) => {
      const input = z
        .object({ status: z.enum(["dispatched", "received", "cancelled"]) })
        .parse(req.body);
      res.json(
        db.mutate((s) => {
          const transfer =
            s.transfers.find((t) => t.id === pathId(req)) ||
            fail(404, "Transfer not found");
          if (
            !(
              transfer.status === "reserved" &&
              ["dispatched", "cancelled"].includes(input.status)
            ) &&
            !(transfer.status === "dispatched" && input.status === "received")
          )
            fail(409, "This transfer cannot make that transition");
          const lot = s.lots.find((l) => l.id === transfer.lotId)!;
          requireStore(req, lot.storeId);
          requireStore(req, transfer.destination);
          if (input.status === "dispatched" && lot.expiry < day())
            fail(
              409,
              "Expired stock cannot be dispatched. Cancel the reservation.",
            );
          if (input.status === "cancelled") lot.reserved -= transfer.quantity;
          if (input.status === "received") {
            lot.quantity -= transfer.quantity;
            lot.reserved -= transfer.quantity;
            const destination = s.lots.find(
              (l) =>
                l.storeId === transfer.destination &&
                l.sku === lot.sku &&
                l.batch === lot.batch &&
                l.expiry === lot.expiry &&
                l.unit === lot.unit,
            );
            if (destination) destination.quantity += transfer.quantity;
            else
              s.lots.push({
                ...lot,
                id: uid(),
                storeId: transfer.destination,
                quantity: transfer.quantity,
                reserved: 0,
              });
          }
          transfer.status = input.status;
          transfer.updatedAt = now();
          event(
            s,
            transfer.id,
            "transfer",
            `Transfer ${input.status}`,
            `${transfer.quantity} ${lot.unit} of ${lot.product}`,
          );
          return transfer;
        }),
      );
    },
  );
  // ------------------------------------------------------------------
  // Corrections. Nothing below destroys a record: a payment is undone by
  // a compensating entry, a case field is amended with both sides kept,
  // and removal is an archive that stays in the audit trail and packets.
  // ------------------------------------------------------------------
  const actorOf = (req: Request) => ({
    actorId: req.auth!.user.id,
    actorLabel: req.auth!.user.displayName || req.auth!.user.username,
  });

  app.post(
    "/api/payments/:id/reverse",
    requireCapability("record_payments"),
    (req, res) => {
      const input = z
        .object({ reason: z.string().trim().min(3).max(500) })
        .parse(req.body);
      res.status(201).json(
        db.mutate((s) => {
          const original =
            s.payments.find((p) => p.id === pathId(req)) ||
            fail(404, "Payment not found");
          const c = findCase(s, original.caseId);
          requireCase(req, c.id);
          if (original.reversalOf)
            fail(409, "A reversal entry cannot itself be reversed");
          if (original.reversedBy)
            fail(409, "This payment has already been reversed");
          const reversal: Payment = {
            id: uid(),
            caseId: original.caseId,
            amount: -original.amount,
            date: day(),
            reference: `Reversal of ${original.reference}`,
            key: `reversal:${original.id}`,
            createdAt: now(),
            reversalOf: original.id,
            reason: input.reason,
          };
          original.reversedBy = reversal.id;
          s.payments.push(reversal);
          // A reversal legitimately reopens a case the original settled, so
          // this bypasses the manual "a fully paid case stays resolved" rule.
          const due = outstanding(s, c);
          if (due === 0) c.status = "resolved";
          else if (c.status === "resolved") c.status = "in_progress";
          amend(s, {
            entityType: "payment",
            entityId: original.id,
            field: "amount",
            from: String(original.amount),
            to: "0",
            kind: "correction",
            reason: input.reason,
            ...actorOf(req),
          });
          event(
            s,
            c.id,
            "case",
            "Payment reversed",
            `${rupees(original.amount)} - ${original.reference}: ${input.reason}`,
          );
          auth.audit({
            actor: req.auth!.user,
            targetId: original.id,
            action: "Payment reversed",
            detail: `${rupees(original.amount)} on ${c.number}`,
            ...requestMeta(req),
          });
          return reversal;
        }),
      );
    },
  );

  const applyCaseField = (
    target: RecoveryCase,
    field: AmendableCaseField,
    value: string | number,
  ) => {
    if (field === "amount") target.amount = Number(value);
    else target[field] = String(value);
  };

  app.post(
    "/api/cases/:id/amend",
    requireCapability("manage_cases"),
    (req, res) => {
      const input = z
        .object({
          changes: z.object({
            title: text.optional(),
            counterparty: text.optional(),
            invoice: z.string().trim().max(200).optional(),
            amount: z.number().int().min(0).max(100_000_000_00).optional(),
            dueDate: isoDate.optional(),
          }),
          kind: z.enum(["correction", "agreed_change"]),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(req.body);
      const fields = (
        Object.keys(input.changes) as AmendableCaseField[]
      ).filter((field) => input.changes[field] !== undefined);
      if (!fields.length) fail(400, "Provide at least one field to amend");
      if (
        fields.some((field) =>
          (FINANCIAL_CASE_FIELDS as readonly string[]).includes(field),
        ) &&
        !hasCapability(req.auth!.user, "amend_financials")
      )
        throw new AuthProblem(
          403,
          "FORBIDDEN",
          "Changing an invoice amount, due date or reference needs the amend_financials permission",
        );
      res.json(
        db.mutate((s) => {
          const c = findCase(s, pathId(req));
          requireCase(req, c.id);
          if (c.archivedAt) fail(409, "Restore this case before amending it");
          if (input.changes.amount !== undefined) {
            const next = input.changes.amount;
            if (c.kind === "payment" && next <= 0)
              fail(400, "A payment case needs a positive amount");
            if (c.kind !== "payment" && next !== 0)
              fail(400, "Document and dispute cases carry no amount");
            const received = c.amount - outstanding(s, c);
            if (next < received)
              fail(
                409,
                `Amount cannot go below the ${rupees(received)} already recorded as received. Reverse a payment first.`,
              );
          }
          const entries = fields.flatMap((field) => {
            const next = input.changes[field]!;
            const previous = c[field];
            if (String(previous) === String(next)) return [];
            const entry = amend(s, {
              entityType: "case",
              entityId: c.id,
              field,
              from: String(previous),
              to: String(next),
              kind: input.kind,
              reason: input.reason,
              ...actorOf(req),
            });
            applyCaseField(c, field, next);
            return [entry];
          });
          if (!entries.length)
            fail(409, "Those values already match the current record");
          if (c.kind === "payment") {
            const due = outstanding(s, c);
            if (due === 0) c.status = "resolved";
            else if (c.status === "resolved") c.status = "in_progress";
          }
          event(
            s,
            c.id,
            "case",
            input.kind === "correction"
              ? "Case corrected"
              : "Case change agreed",
            `${entries.map((entry) => entry.field).join(", ")}: ${input.reason}`,
          );
          auth.audit({
            actor: req.auth!.user,
            targetId: c.id,
            action: "Case amended",
            detail: `${c.number} ${entries
              .map((entry) => `${entry.field} ${entry.from} to ${entry.to}`)
              .join("; ")}`,
            ...requestMeta(req),
          });
          return { case: c, amendments: entries };
        }),
      );
    },
  );

  const archiveTarget = (
    req: Request,
    s: State,
    entity: string,
    id: string,
  ): {
    capability: Capability;
    record: Archivable & { id: string };
    entityType: string;
    label: string;
  } => {
    if (entity === "case") {
      const c = findCase(s, id);
      requireCase(req, c.id);
      return {
        capability: "manage_cases",
        record: c,
        entityType: "case",
        label: `${c.number} ${c.counterparty}`,
      };
    }
    if (entity === "task") {
      const task =
        s.tasks.find((item) => item.id === id) ||
        fail(404, "Follow-up not found");
      requireCase(req, task.caseId);
      return {
        capability: "manage_tasks",
        record: task,
        entityType: "task",
        label: task.title,
      };
    }
    if (entity === "evidence") {
      const item =
        s.evidence.find((record) => record.id === id) ||
        fail(404, "Evidence not found");
      requireCase(req, item.caseId);
      return {
        capability: "manage_evidence",
        record: item,
        entityType: "evidence",
        label: item.name,
      };
    }
    if (entity === "store") {
      const store =
        s.stores.find((item) => item.id === id) || fail(404, "Store not found");
      requireStore(req, store.id);
      return {
        capability: "manage_workspace",
        record: store,
        entityType: "store",
        label: `${store.name}, ${store.locality}`,
      };
    }
    if (entity === "lot") {
      const lot =
        s.lots.find((item) => item.id === id) ||
        fail(404, "Stock lot not found");
      requireStore(req, lot.storeId);
      return {
        capability: "manage_inventory",
        record: lot,
        entityType: "stock",
        label: `${lot.product} (${lot.batch})`,
      };
    }
    return fail(400, "Unknown record type");
  };

  const activeTransfer = (status: string) =>
    ["reserved", "dispatched"].includes(status);

  /** Archiving must not strand a record that something live still points at. */
  const archiveGuard = (
    s: State,
    entity: string,
    record: Archivable & { id: string },
  ) => {
    if (entity === "store") {
      if (s.lots.some((lot) => lot.storeId === record.id && !lot.archivedAt))
        fail(409, "Archive or move this store's stock lots first");
      if (
        s.transfers.some(
          (transfer) =>
            activeTransfer(transfer.status) &&
            (transfer.destination === record.id ||
              s.lots.some(
                (lot) => lot.id === transfer.lotId && lot.storeId === record.id,
              )),
        )
      )
        fail(409, "Settle this store's active transfers first");
    }
    if (entity === "lot") {
      const lot = record as Lot;
      if (lot.reserved > 0)
        fail(409, "Cancel the reservations on this lot before archiving it");
      if (
        s.transfers.some(
          (transfer) =>
            transfer.lotId === lot.id && activeTransfer(transfer.status),
        )
      )
        fail(409, "This lot has an active transfer");
    }
  };

  app.post("/api/archive/:entity/:id", (req, res) => {
    const input = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .parse(req.body);
    const entity = String(req.params.entity);
    res.json(
      db.mutate((s) => {
        const target = archiveTarget(req, s, entity, pathId(req));
        if (!hasCapability(req.auth!.user, target.capability))
          throw new AuthProblem(
            403,
            "FORBIDDEN",
            "You do not have permission for this action",
          );
        if (target.record.archivedAt)
          fail(409, "This record is already archived");
        archiveGuard(s, entity, target.record);
        target.record.archivedAt = now();
        target.record.archivedBy = actorOf(req).actorLabel;
        target.record.archiveReason = input.reason;
        event(
          s,
          target.record.id,
          target.entityType,
          "Record archived",
          `${target.label}: ${input.reason}`,
        );
        auth.audit({
          actor: req.auth!.user,
          targetId: target.record.id,
          action: "Record archived",
          detail: `${entity}: ${target.label}`,
          ...requestMeta(req),
        });
        return target.record;
      }),
    );
  });

  app.post("/api/restore/:entity/:id", (req, res) => {
    const entity = String(req.params.entity);
    res.json(
      db.mutate((s) => {
        const target = archiveTarget(req, s, entity, pathId(req));
        if (!hasCapability(req.auth!.user, target.capability))
          throw new AuthProblem(
            403,
            "FORBIDDEN",
            "You do not have permission for this action",
          );
        if (!target.record.archivedAt) fail(409, "This record is not archived");
        if (entity === "lot") {
          const lot = target.record as Lot;
          if (
            s.stores.some(
              (store) => store.id === lot.storeId && store.archivedAt,
            )
          )
            fail(409, "Restore the owning store first");
        }
        if (entity === "task" || entity === "evidence") {
          const owner = (target.record as unknown as { caseId: string }).caseId;
          if (s.cases.some((c) => c.id === owner && c.archivedAt))
            fail(409, "Restore the case first");
        }
        target.record.archivedAt = null;
        delete target.record.archivedBy;
        delete target.record.archiveReason;
        event(
          s,
          target.record.id,
          target.entityType,
          "Record restored",
          target.label,
        );
        auth.audit({
          actor: req.auth!.user,
          targetId: target.record.id,
          action: "Record restored",
          detail: `${entity}: ${target.label}`,
          ...requestMeta(req),
        });
        return target.record;
      }),
    );
  });

  app.post(
    "/api/workspace/clear-sample",
    requireCapability("manage_workspace"),
    (req, res) => {
      res.json(
        db.mutate((s) => {
          const at = now();
          const by = actorOf(req).actorLabel;
          const reason = "Seeded demonstration record cleared by the owner";
          const held: string[] = [];
          let archived = 0;
          const sweep = (
            collection: (Archivable & { id: string })[],
            entity: string,
            label: (record: never) => string,
          ) => {
            for (const record of collection) {
              if (!record.sample || record.archivedAt) continue;
              try {
                archiveGuard(s, entity, record);
              } catch {
                held.push(label(record as never));
                continue;
              }
              record.archivedAt = at;
              record.archivedBy = by;
              record.archiveReason = reason;
              archived++;
            }
          };
          sweep(s.cases, "case", (c: RecoveryCase) => c.number);
          sweep(s.tasks, "task", (t: { title: string }) => t.title);
          sweep(s.evidence, "evidence", (e: { name: string }) => e.name);
          sweep(s.lots, "lot", (l: Lot) => l.product);
          sweep(s.stores, "store", (store: { name: string }) => store.name);
          s.workspace.sample = false;
          event(
            s,
            "workspace",
            "workspace",
            "Sample data cleared",
            held.length
              ? `${archived} seeded records archived; ${held.length} held by live activity`
              : `${archived} seeded records archived`,
          );
          auth.audit({
            actor: req.auth!.user,
            action: "Sample data cleared",
            detail: `${archived} archived, ${held.length} held`,
            ...requestMeta(req),
          });
          return { archived, held };
        }),
      );
    },
  );

  app.get("/api/integrity", requireCapability("view_activity"), (_req, res) =>
    res.json(verifyAmendments(db.read())),
  );

  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "Endpoint not found")),
  );
  if (existsSync(resolve("dist/index.html"))) {
    app.use(express.static(resolve("dist")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  }
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        code: "INVALID_INPUT",
        error: error.issues
          .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
          .join("; "),
      });
    if (error instanceof multer.MulterError)
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        code: "INVALID_UPLOAD",
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Evidence files must be 10 MB or smaller"
            : error.message,
      });
    if (error instanceof AuthProblem)
      return res
        .status(error.status)
        .json({ error: error.message, code: error.code });
    if (error instanceof MailDeliveryError)
      return res.status(503).json({
        error: "We could not deliver the email. Please try again shortly.",
        code: "EMAIL_DELIVERY_FAILED",
      });
    if (error instanceof HttpError)
      return res
        .status(error.status)
        .json({ error: error.message, code: error.code });
    if (error instanceof SyntaxError)
      return res
        .status(400)
        .json({ error: "Invalid JSON request", code: "INVALID_JSON" });
    console.error(error.name, error.message);
    return res.status(500).json({
      error:
        "The operation failed. Your saved records are unchanged. Check the server connection and try again.",
      code: "INTERNAL_ERROR",
    });
  });
  simulation.start();
  return { app, db, auth, simulation };
}
