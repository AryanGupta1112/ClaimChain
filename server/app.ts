import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import { z } from "zod";
import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import PDFDocument from "pdfkit";
import { StoreDB, uid, now, day, event } from "./store.js";
import {
  capabilities,
  draftWithBedrock,
  extractImage,
  mirrorEvidence,
} from "./aws.js";
import type { State, RecoveryCase, Draft } from "../shared/types.js";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
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
  options: { directory?: string; seed?: boolean; password?: string } = {},
) {
  const directory = resolve(
    options.directory || process.env.DATA_DIR || "data",
  );
  const db = new StoreDB(
    directory,
    options.seed ?? process.env.SEED_SAMPLE !== "false",
  );
  const app = express();
  const password = options.password ?? process.env.ACCESS_PASSWORD;
  const secret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
  const secure = process.env.COOKIE_SECURE === "true";
  const attempts = new Map<string, { count: number; until: number }>();
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
    res.json({ status: "ok", authentication: Boolean(password) }),
  );
  app.post("/api/login", (req, res) => {
    if (!password) return res.json({ ok: true });
    const ip = req.ip || "local";
    const previous = attempts.get(ip);
    const attempt =
      previous && previous.until > Date.now()
        ? previous
        : { count: 0, until: Date.now() + 600000 };
    if (attempt.count >= 10)
      fail(429, "Too many attempts. Try again in ten minutes.");
    const candidate = z
      .object({ password: z.string().max(512) })
      .parse(req.body).password;
    if (
      !timingSafeEqual(
        createHash("sha256").update(candidate).digest(),
        createHash("sha256").update(password).digest(),
      )
    ) {
      attempts.set(ip, { ...attempt, count: attempt.count + 1 });
      fail(401, "Incorrect workspace password");
    }
    attempts.delete(ip);
    const payload = `${Date.now() + 86400000}.${randomBytes(16).toString("hex")}`;
    const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
    res.setHeader(
      "Set-Cookie",
      `claimchain=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure ? "; Secure" : ""}`,
    );
    res.json({ ok: true });
  });
  app.post("/api/logout", (_req, res) => {
    res.setHeader(
      "Set-Cookie",
      `claimchain=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? "; Secure" : ""}`,
    );
    res.json({ ok: true });
  });
  app.use("/api", (req, _res, next) => {
    if (!password) return next();
    const token =
      req.headers.cookie
        ?.split("; ")
        .find((p) => p.startsWith("claimchain="))
        ?.slice(11) || "";
    const [expires, nonce, signature] = token.split(".");
    const expected = createHmac("sha256", secret)
      .update(`${expires}.${nonce}`)
      .digest("hex");
    if (
      !signature ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
      Number(expires) <= Date.now()
    )
      return next(new HttpError(401, "Sign in to your workspace"));
    next();
  });
  app.get("/api/bootstrap", (_req, res) =>
    res.json({
      ...db.read(),
      capabilities: { ...capabilities(), auth: Boolean(password) },
    }),
  );
  app.get("/api/export", (_req, res) => {
    res
      .attachment(`claimchain-workspace-${day()}.json`)
      .json({ exportedAt: now(), schemaVersion: 1, ...db.read() });
  });
  app.patch("/api/workspace", (req, res) => {
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
  });
  app.post("/api/cases", (req, res) => {
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
  app.get("/api/cases/:id", (req, res) => {
    const s = db.read(),
      c = findCase(s, pathId(req));
    res.json({
      ...c,
      payments: s.payments.filter((p) => p.caseId === c.id),
      evidence: s.evidence.filter((e) => e.caseId === c.id),
      documents: s.documents.filter((d) => d.caseId === c.id),
      tasks: s.tasks.filter((t) => t.caseId === c.id),
      checklist: s.checklist.filter((t) => t.caseId === c.id),
      events: s.events.filter((e) => e.entityId === c.id),
    });
  });
  app.patch("/api/cases/:id", (req, res) => {
    const input = z
      .object({
        summary: z.string().trim().max(10000).optional(),
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
      })
      .parse(req.body);
    res.json(
      db.mutate((s) => {
        const c = findCase(s, pathId(req));
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
  app.post("/api/cases/:id/payments", (req, res) => {
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
        if (
          s.payments.some(
            (p) =>
              p.caseId === c.id &&
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
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  app.post("/api/cases/:id/evidence", upload.single("file"), (req, res) => {
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
            : f.buffer[0] === 255 && f.buffer[1] === 216 && f.buffer[2] === 255;
    if (!signatureOK) fail(400, "The file contents do not match its type");
    const digest = createHash("sha256").update(f.buffer).digest("hex");
    const id = uid();
    let createdPath: string | undefined;
    try {
      const result = db.mutate((s) => {
        const c = findCase(s, pathId(req));
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
  });
  app.get("/api/evidence/:id/file", (req, res) => {
    const e =
      db.read().evidence.find((e) => e.id === pathId(req)) ||
      fail(404, "Evidence not found");
    res.type(e.mime).download(join(directory, "evidence", e.id), e.name);
  });
  app.post("/api/evidence/:id/extract", async (req, res) => {
    const e =
      db.read().evidence.find((e) => e.id === pathId(req)) ||
      fail(404, "Evidence not found");
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
  });
  app.post("/api/evidence/:id/mirror", async (req, res) => {
    if (!capabilities().s3) fail(409, "S3 is not configured");
    const e =
      db.read().evidence.find((e) => e.id === pathId(req)) ||
      fail(404, "Evidence not found");
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
  });
  app.post("/api/cases/:id/documents", async (req, res) => {
    const input = z
      .object({
        kind: z.enum(["reminder", "request", "statement"]),
        ai: z.boolean().default(false),
      })
      .parse(req.body);
    const snapshot = db.read(),
      c = findCase(snapshot, pathId(req));
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
  });
  app.patch("/api/documents/:id", (req, res) => {
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
        if (input.revision !== d.revision)
          fail(409, "This draft changed elsewhere. Reopen it before editing.");
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
  });
  app.get("/api/documents/:id/download", (req, res) => {
    const d =
      db.read().documents.find((d) => d.id === pathId(req)) ||
      fail(404, "Draft not found");
    pdf(res, "claimchain-letter.pdf", (doc) => {
      doc.fontSize(20).fillColor("#167451").text("ClaimChain");
      doc
        .moveDown()
        .fontSize(11)
        .fillColor("#202823")
        .text(d.body, { lineGap: 5 });
    });
  });
  app.get("/api/cases/:id/packet", (req, res) => {
    const s = db.read(),
      c = findCase(s, pathId(req));
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
          `${p.date} | ${rupees(p.amount)} | ${p.reference} | Owner recorded`,
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
        "Contains recorded facts, evidence manifest, extracted text and prepared drafts. Original files are downloaded separately. Owner-recorded payments are not bank verified. Hashes identify file bytes, not authenticity. No correspondence has been sent and no legal filing has been made by this export.",
      );
    });
  });
  app.post("/api/tasks", (req, res) => {
    const input = z
      .object({ caseId: text, title: text, dueDate: isoDate })
      .parse(req.body);
    res.status(201).json(
      db.mutate((s) => {
        findCase(s, input.caseId);
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
  app.patch("/api/tasks/:id", (req, res) => {
    const input = z.object({ done: z.boolean() }).parse(req.body);
    res.json(
      db.mutate((s) => {
        const task =
          s.tasks.find((t) => t.id === pathId(req)) ||
          fail(404, "Task not found");
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
  app.patch("/api/checklist/:id", (req, res) => {
    const input = z.object({ done: z.boolean() }).parse(req.body);
    res.json(
      db.mutate((s) => {
        const item =
          s.checklist.find((i) => i.id === pathId(req)) ||
          fail(404, "Requirement not found");
        const c = findCase(s, item.caseId);
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
  });
  app.post("/api/stores", (req, res) => {
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
  app.post("/api/stock", (req, res) => {
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
    res.status(201).json(
      db.mutate((s) => {
        if (!s.stores.some((store) => store.id === input.storeId))
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
  app.post("/api/transfers", (req, res) => {
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
        if (!s.stores.some((store) => store.id === input.destination))
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
  });
  app.post("/api/transfers/:id/transition", (req, res) => {
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
  });
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
        error: error.issues
          .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
          .join("; "),
      });
    if (error instanceof multer.MulterError)
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Evidence files must be 10 MB or smaller"
            : error.message,
      });
    if (error instanceof HttpError)
      return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: "Invalid JSON request" });
    console.error(error.name, error.message);
    return res.status(500).json({
      error:
        "The operation failed. Your saved records are unchanged. Check the server connection and try again.",
    });
  });
  return { app, db };
}
