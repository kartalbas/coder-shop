import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const DEV_SESSION_SECRET = "coder-shop-dev-session-secret-change-me";

export function sessionSecret(): string {
  return env.SESSION_SECRET ?? DEV_SESSION_SECRET;
}

export interface SessionPayload {
  userId: string;
  exp: number;
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function signSessionToken(payload: SessionPayload, secret = sessionSecret()): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = sign(body, secret).toString("base64url");
  return `${body}.${mac}`;
}

export function verifySessionToken(
  token: string,
  secret = sessionSecret(),
  now = Date.now(),
): SessionPayload | null {
  const [body, mac, ...rest] = token.split(".");
  if (!body || !mac || rest.length > 0) return null;
  const expected = sign(body, secret);
  const provided = Buffer.from(mac, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp <= now) return null;
  return payload;
}

export function createSessionToken(userId: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  return signSessionToken({ userId, exp: Date.now() + ttlSeconds * 1000 });
}
