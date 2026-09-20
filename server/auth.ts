import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  AUTH_ROLES,
  ROLE_DEFINITIONS,
  roleList,
  type AuthRole,
  type AuthUser,
  type PageResult,
  type SecurityAuditEntry,
  type UserScopes,
} from "../shared/auth.js";

type UserRow = {
  id: string;
  username: string;
  username_norm: string;
  email: string;
  email_norm: string;
  display_name: string;
  role: AuthRole;
  password_salt: string;
  password_hash: string;
  verified: number;
  active: number;
  scopes_json: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type RequestRow = {
  id: string;
  type: "verification" | "reset";
  user_id: string;
  code_digest: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  invalidated_at: string | null;
  attempts: number;
};

export class AuthProblem extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();
const normalize = (value: string) => value.trim().toLowerCase();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const parseScopes = (value: string): UserScopes => {
  try {
    const parsed = JSON.parse(value) as Partial<UserScopes>;
    return {
      caseIds: [...new Set((parsed.caseIds || []).map(String))],
      storeIds: [...new Set((parsed.storeIds || []).map(String))],
    };
  } catch {
    return { caseIds: [], storeIds: [] };
  }
};

export const DEMO_PASSWORD = "ClaimChainDemo!2026";

export function validatePassword(
  password: string,
  user?: { username: string; email: string },
) {
  const errors: string[] = [];
  if (password.length < 12) errors.push("Use at least 12 characters");
  if (!/[a-z]/.test(password)) errors.push("Add a lowercase letter");
  if (!/[A-Z]/.test(password)) errors.push("Add an uppercase letter");
  if (!/\d/.test(password)) errors.push("Add a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Add a symbol");
  if (/^\d+$/.test(password))
    errors.push("Password cannot be entirely numeric");
  const common = ["password", "password123", "qwerty123", "claimchain"];
  if (common.includes(password.toLowerCase()))
    errors.push("Choose a less common password");
  if (user) {
    const lowered = password.toLowerCase();
    const local = user.email.split("@")[0]?.toLowerCase() || "";
    if (
      (user.username.length >= 4 &&
        lowered.includes(user.username.toLowerCase())) ||
      (local.length >= 4 && lowered.includes(local))
    )
      errors.push("Password is too similar to the account name");
  }
  return errors;
}

export class AuthService {
  private codeSecret: string;
  private requestRate = new Map<string, number[]>();

  constructor(
    private db: DatabaseSync,
    seedSample: boolean,
    seedUsers = true,
  ) {
    this.codeSecret =
      process.env.SESSION_SECRET ||
      "claimchain-local-code-secret-not-for-production";
    const migration = readFileSync(
      fileURLToPath(new URL("./migrations/002_auth_rbac.sql", import.meta.url)),
      "utf8",
    );
    this.db.exec("PRAGMA foreign_keys=ON;");
    this.db.exec(migration);
    if (seedUsers) this.seedInitialUsers(seedSample);
  }

  private passwordHash(password: string, salt: string) {
    return scryptSync(password, salt, 64).toString("hex");
  }

  private row(id: string) {
    return this.db.prepare("SELECT * FROM auth_users WHERE id=?").get(id) as
      UserRow | undefined;
  }

  private byIdentifier(identifier: string) {
    const value = normalize(identifier);
    return this.db
      .prepare("SELECT * FROM auth_users WHERE username_norm=? OR email_norm=?")
      .get(value, value) as UserRow | undefined;
  }

  private safe(row: UserRow): AuthUser {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      verified: Boolean(row.verified),
      active: Boolean(row.active),
      scopes: parseScopes(row.scopes_json),
      capabilities: [...ROLE_DEFINITIONS[row.role].capabilities],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    };
  }

  private insertUser(input: {
    username: string;
    email: string;
    displayName: string;
    role: AuthRole;
    password: string;
    verified: boolean;
    scopes?: UserScopes;
  }) {
    const id = randomUUID();
    const created = now();
    const salt = randomBytes(16).toString("hex");
    this.db
      .prepare(
        `INSERT INTO auth_users(
          id,username,username_norm,email,email_norm,display_name,role,
          password_salt,password_hash,verified,active,scopes_json,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.username.trim(),
        normalize(input.username),
        input.email.trim(),
        normalize(input.email),
        input.displayName.trim(),
        input.role,
        salt,
        this.passwordHash(input.password, salt),
        input.verified ? 1 : 0,
        1,
        JSON.stringify(input.scopes || { caseIds: [], storeIds: [] }),
        created,
        created,
      );
    return this.safe(this.row(id)!);
  }

  private seedInitialUsers(seedSample: boolean) {
    const count = (
      this.db.prepare("SELECT COUNT(*) AS count FROM auth_users").get() as {
        count: number;
      }
    ).count;
    if (count) return;
    const password =
      process.env.AUTH_BOOTSTRAP_PASSWORD || (seedSample ? DEMO_PASSWORD : "");
    if (!password)
      throw new Error(
        "AUTH_BOOTSTRAP_PASSWORD is required when creating a non-sample workspace",
      );
    const errors = validatePassword(password);
    if (errors.length)
      throw new Error(`Invalid bootstrap password: ${errors.join("; ")}`);
    this.insertUser({
      username: process.env.AUTH_BOOTSTRAP_USERNAME || "admin",
      email: process.env.AUTH_BOOTSTRAP_EMAIL || "admin@claimchain.local",
      displayName: "Aarav Mehta",
      role: "workspace_admin",
      password,
      verified: true,
    });
    if (!seedSample) return;
    this.insertUser({
      username: "operator",
      email: "operator@claimchain.local",
      displayName: "Nisha Rao",
      role: "recovery_operator",
      password: DEMO_PASSWORD,
      verified: true,
      scopes: {
        caseIds: ["case-1", "case-2", "case-4"],
        storeIds: ["store-1", "store-2"],
      },
    });
    this.insertUser({
      username: "auditor",
      email: "auditor@claimchain.local",
      displayName: "Kabir Shah",
      role: "auditor",
      password: DEMO_PASSWORD,
      verified: true,
    });
  }

  roles() {
    return roleList();
  }

  authenticate(identifier: string, password: string) {
    const row = this.byIdentifier(identifier);
    if (!row) return undefined;
    const candidate = Buffer.from(
      this.passwordHash(password, row.password_salt),
      "hex",
    );
    const expected = Buffer.from(row.password_hash, "hex");
    if (
      candidate.length !== expected.length ||
      !timingSafeEqual(candidate, expected)
    )
      return undefined;
    return this.safe(row);
  }

  createSession(userId: string, meta: { ip: string; userAgent: string }) {
    const raw = randomBytes(32).toString("base64url");
    const created = now();
    const ttlHours = Math.max(
      1,
      Number(process.env.AUTH_SESSION_TTL_HOURS || 24),
    );
    const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
    this.db
      .prepare(
        "INSERT INTO auth_sessions(id,user_id,token_digest,created_at,updated_at,expires_at,ip,user_agent) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        userId,
        digest(raw),
        created,
        created,
        expiresAt,
        meta.ip,
        meta.userAgent.slice(0, 300),
      );
    this.db
      .prepare("UPDATE auth_users SET last_login_at=?,updated_at=? WHERE id=?")
      .run(created, created, userId);
    return { token: raw, expiresAt };
  }

  resolveSession(token: string) {
    if (!token) return undefined;
    const session = this.db
      .prepare(
        `SELECT s.id AS session_id,s.expires_at,u.*
         FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id
         WHERE s.token_digest=? AND s.revoked_at IS NULL`,
      )
      .get(digest(token)) as
      (UserRow & { session_id: string; expires_at: string }) | undefined;
    if (!session) return undefined;
    if (session.expires_at <= now() || !session.active || !session.verified) {
      this.db
        .prepare(
          "UPDATE auth_sessions SET revoked_at=?,updated_at=? WHERE id=?",
        )
        .run(now(), now(), session.session_id);
      return undefined;
    }
    return { user: this.safe(session), sessionId: session.session_id };
  }

  revokeSession(sessionId: string) {
    const timestamp = now();
    this.db
      .prepare(
        "UPDATE auth_sessions SET revoked_at=?,updated_at=? WHERE id=? AND revoked_at IS NULL",
      )
      .run(timestamp, timestamp, sessionId);
  }

  revokeUserSessions(userId: string) {
    const timestamp = now();
    this.db
      .prepare(
        "UPDATE auth_sessions SET revoked_at=?,updated_at=? WHERE user_id=? AND revoked_at IS NULL",
      )
      .run(timestamp, timestamp, userId);
  }

  audit(input: {
    actor?: AuthUser;
    actorLabel?: string;
    targetId?: string;
    action: string;
    detail: string;
    ip?: string;
    userAgent?: string;
  }) {
    this.db
      .prepare(
        "INSERT INTO security_audit(id,actor_id,actor_label,target_id,action,detail,ip,user_agent,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        input.actor?.id || null,
        input.actor?.displayName || input.actorLabel || "Anonymous",
        input.targetId || null,
        input.action,
        input.detail.slice(0, 500),
        input.ip || "",
        (input.userAgent || "").slice(0, 300),
        now(),
      );
  }

  checkRate(key: string, limit = 5, windowMs = 10 * 60 * 1000) {
    const cutoff = Date.now() - windowMs;
    const current = (this.requestRate.get(key) || []).filter(
      (time) => time > cutoff,
    );
    if (current.length >= limit)
      throw new AuthProblem(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again later.",
      );
    current.push(Date.now());
    this.requestRate.set(key, current);
  }

  createCode(type: "verification" | "reset", userId: string) {
    const id = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const created = now();
    const ttl = Math.max(5, Number(process.env.AUTH_CODE_TTL_MINUTES || 15));
    const expiresAt = new Date(Date.now() + ttl * 60000).toISOString();
    this.db
      .prepare(
        "UPDATE auth_requests SET invalidated_at=? WHERE user_id=? AND type=? AND used_at IS NULL AND invalidated_at IS NULL",
      )
      .run(created, userId, type);
    this.db
      .prepare(
        "INSERT INTO auth_requests(id,type,user_id,code_digest,created_at,expires_at) VALUES(?,?,?,?,?,?)",
      )
      .run(id, type, userId, this.codeDigest(id, code), created, expiresAt);
    return { requestId: id, code, expiresAt };
  }

  private codeDigest(requestId: string, code: string) {
    return digest(`${this.codeSecret}:${requestId}:${code}`);
  }

  consumeCode(type: "verification" | "reset", requestId: string, code: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const request = this.db
        .prepare("SELECT * FROM auth_requests WHERE id=? AND type=?")
        .get(requestId, type) as RequestRow | undefined;
      if (!request)
        throw new AuthProblem(404, "REQUEST_NOT_FOUND", "Request not found");
      if (request.used_at)
        throw new AuthProblem(
          409,
          "REQUEST_USED",
          "This code has already been used",
        );
      if (request.invalidated_at || request.expires_at <= now())
        throw new AuthProblem(409, "REQUEST_EXPIRED", "This code has expired");
      if (request.attempts >= 5)
        throw new AuthProblem(
          429,
          "RATE_LIMITED",
          "Too many incorrect attempts",
        );
      const actual = Buffer.from(this.codeDigest(requestId, code));
      const expected = Buffer.from(request.code_digest);
      if (!timingSafeEqual(actual, expected)) {
        this.db
          .prepare("UPDATE auth_requests SET attempts=attempts+1 WHERE id=?")
          .run(requestId);
        this.db.exec("COMMIT");
        throw new AuthProblem(400, "INVALID_CODE", "The code is incorrect");
      }
      const timestamp = now();
      this.db
        .prepare("UPDATE auth_requests SET used_at=? WHERE id=?")
        .run(timestamp, requestId);
      this.db.exec("COMMIT");
      return request.user_id;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  exposeCode(result: { requestId: string; code: string; expiresAt: string }) {
    return process.env.AUTH_EXPOSE_CODES === "true"
      ? {
          requestId: result.requestId,
          developmentCode: result.code,
          expiresAt: result.expiresAt,
        }
      : { requestId: result.requestId, expiresAt: result.expiresAt };
  }

  identifierUser(identifier: string) {
    const row = this.byIdentifier(identifier);
    return row ? this.safe(row) : undefined;
  }

  markVerified(userId: string) {
    const timestamp = now();
    this.db
      .prepare("UPDATE auth_users SET verified=1,updated_at=? WHERE id=?")
      .run(timestamp, userId);
    return this.safe(this.row(userId)!);
  }

  resetPassword(userId: string, password: string) {
    const row = this.row(userId);
    if (!row) throw new AuthProblem(404, "USER_NOT_FOUND", "Account not found");
    const errors = validatePassword(password, {
      username: row.username,
      email: row.email,
    });
    if (errors.length)
      throw new AuthProblem(400, "INVALID_PASSWORD", errors.join(". "));
    const salt = randomBytes(16).toString("hex");
    const timestamp = now();
    this.db
      .prepare(
        "UPDATE auth_users SET password_salt=?,password_hash=?,updated_at=? WHERE id=?",
      )
      .run(salt, this.passwordHash(password, salt), timestamp, userId);
    this.revokeUserSessions(userId);
  }

  getUser(id: string) {
    const row = this.row(id);
    return row ? this.safe(row) : undefined;
  }

  listUsers(page: number, pageSize: number, query = ""): PageResult<AuthUser> {
    const offset = (page - 1) * pageSize;
    const like = `%${normalize(query)}%`;
    const where = query
      ? "WHERE username_norm LIKE ? OR email_norm LIKE ? OR lower(display_name) LIKE ?"
      : "";
    const params = query ? [like, like, like] : [];
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS count FROM auth_users ${where}`)
        .get(...params) as {
        count: number;
      }
    ).count;
    const rows = this.db
      .prepare(
        `SELECT * FROM auth_users ${where} ORDER BY created_at ASC LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, offset) as UserRow[];
    return {
      items: rows.map((row) => this.safe(row)),
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private ensureRole(role: string): AuthRole {
    if (!AUTH_ROLES.includes(role as AuthRole))
      throw new AuthProblem(400, "INVALID_INPUT", "Choose a valid role");
    return role as AuthRole;
  }

  createUser(input: {
    username: string;
    email: string;
    displayName: string;
    role: string;
    password: string;
    scopes: UserScopes;
  }) {
    const role = this.ensureRole(input.role);
    const existing = this.byIdentifier(input.username);
    if (existing)
      throw new AuthProblem(
        409,
        "USERNAME_CONFLICT",
        "Username is already in use",
      );
    const emailExisting = this.byIdentifier(input.email);
    if (emailExisting)
      throw new AuthProblem(409, "EMAIL_CONFLICT", "Email is already in use");
    const errors = validatePassword(input.password, input);
    if (errors.length)
      throw new AuthProblem(400, "INVALID_PASSWORD", errors.join(". "));
    return this.insertUser({ ...input, role, verified: false });
  }

  updateUser(
    id: string,
    input: Partial<{
      username: string;
      email: string;
      displayName: string;
      role: string;
      active: boolean;
      verified: boolean;
      scopes: UserScopes;
      password: string;
    }>,
  ) {
    const row = this.row(id);
    if (!row) throw new AuthProblem(404, "USER_NOT_FOUND", "Account not found");
    const nextRole = input.role ? this.ensureRole(input.role) : row.role;
    const nextActive = input.active ?? Boolean(row.active);
    if (
      row.role === "workspace_admin" &&
      (!nextActive || nextRole !== "workspace_admin") &&
      this.activeAdminCount() <= 1
    )
      throw new AuthProblem(
        409,
        "LAST_ADMIN",
        "The final administrator must remain active",
      );
    const username = input.username?.trim() || row.username;
    const email = input.email?.trim() || row.email;
    const usernameOwner = this.byIdentifier(username);
    if (usernameOwner && usernameOwner.id !== id)
      throw new AuthProblem(
        409,
        "USERNAME_CONFLICT",
        "Username is already in use",
      );
    const emailOwner = this.byIdentifier(email);
    if (emailOwner && emailOwner.id !== id)
      throw new AuthProblem(409, "EMAIL_CONFLICT", "Email is already in use");
    const emailChanged = normalize(email) !== row.email_norm;
    const roleScope = ROLE_DEFINITIONS[nextRole].scope;
    const scopes =
      roleScope === "assigned"
        ? input.scopes || parseScopes(row.scopes_json)
        : { caseIds: [], storeIds: [] };
    const timestamp = now();
    this.db
      .prepare(
        `UPDATE auth_users SET username=?,username_norm=?,email=?,email_norm=?,display_name=?,
         role=?,active=?,verified=?,scopes_json=?,updated_at=? WHERE id=?`,
      )
      .run(
        username,
        normalize(username),
        email,
        normalize(email),
        input.displayName?.trim() || row.display_name,
        nextRole,
        nextActive ? 1 : 0,
        emailChanged ? 0 : (input.verified ?? Boolean(row.verified)) ? 1 : 0,
        JSON.stringify(scopes),
        timestamp,
        id,
      );
    if (input.password) this.resetPassword(id, input.password);
    this.revokeUserSessions(id);
    return this.safe(this.row(id)!);
  }

  deleteUser(id: string, actorId: string) {
    if (id === actorId)
      throw new AuthProblem(
        409,
        "CANNOT_DELETE_SELF",
        "You cannot delete your own account",
      );
    const row = this.row(id);
    if (!row) throw new AuthProblem(404, "USER_NOT_FOUND", "Account not found");
    if (
      row.role === "workspace_admin" &&
      row.active &&
      this.activeAdminCount() <= 1
    )
      throw new AuthProblem(
        409,
        "LAST_ADMIN",
        "The final administrator cannot be deleted",
      );
    this.db.prepare("DELETE FROM auth_users WHERE id=?").run(id);
  }

  private activeAdminCount() {
    return (
      this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM auth_users WHERE role='workspace_admin' AND active=1",
        )
        .get() as { count: number }
    ).count;
  }

  listAudit(page: number, pageSize: number): PageResult<SecurityAuditEntry> {
    const total = (
      this.db.prepare("SELECT COUNT(*) AS count FROM security_audit").get() as {
        count: number;
      }
    ).count;
    const rows = this.db
      .prepare(
        "SELECT * FROM security_audit ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(pageSize, (page - 1) * pageSize) as Array<{
      id: string;
      actor_id: string | null;
      actor_label: string;
      target_id: string | null;
      action: string;
      detail: string;
      ip: string;
      created_at: string;
    }>;
    return {
      items: rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorLabel: row.actor_label,
        targetId: row.target_id,
        action: row.action,
        detail: row.detail,
        ip: row.ip,
        createdAt: row.created_at,
      })),
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
