import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthRole, AuthUser, UserScopes } from "../shared/auth.js";
import { AUTH_ROLES, ROLE_DEFINITIONS } from "../shared/auth.js";

type DjangoSession = {
  sub: string;
  username: string;
  email: string;
  displayName: string;
  role: AuthRole;
  scopes: UserScopes;
  verified: boolean;
  active: boolean;
  sid: string;
  iat: number;
  exp: number;
};

const base64 = (value: Buffer) => value.toString("base64url");

export async function resolveDjangoSession(token: string) {
  if (!token) return undefined;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return undefined;
  const expected = base64(
    createHmac(
      "sha256",
      process.env.AUTH_TOKEN_SECRET ||
        "claimchain-local-django-token-secret-not-for-production",
    )
      .update(encoded)
      .digest(),
  );
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actual.length !== expectedBuffer.length ||
    !timingSafeEqual(actual, expectedBuffer)
  )
    return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as DjangoSession;
    if (
      !payload.sub ||
      !payload.username ||
      !payload.email ||
      !AUTH_ROLES.includes(payload.role) ||
      !payload.verified ||
      !payload.active ||
      payload.exp <= Math.floor(Date.now() / 1000)
    )
      return undefined;
    const scopes = payload.scopes || { caseIds: [], storeIds: [] };
    const user: AuthUser = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      verified: true,
      active: true,
      scopes: {
        caseIds: Array.isArray(scopes.caseIds)
          ? scopes.caseIds.map(String)
          : [],
        storeIds: Array.isArray(scopes.storeIds)
          ? scopes.storeIds.map(String)
          : [],
      },
      capabilities: [...ROLE_DEFINITIONS[payload.role].capabilities],
      createdAt: new Date(payload.iat * 1000).toISOString(),
      updatedAt: new Date(payload.iat * 1000).toISOString(),
      lastLoginAt: new Date(payload.iat * 1000).toISOString(),
    };
    const response = await fetch(
      `${process.env.DJANGO_AUTH_URL || "http://127.0.0.1:8000"}/auth/internal/session`,
      {
        headers: {
          cookie: `${process.env.AUTH_COOKIE_NAME || "claimchain_session"}=${token}`,
        },
      },
    );
    if (!response.ok) return undefined;
    return { user, sessionId: `django:${payload.sid}` };
  } catch {
    return undefined;
  }
}
