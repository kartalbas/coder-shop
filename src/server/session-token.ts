import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const MIN_PRODUCTION_SECRET_LENGTH = 32;

export interface SessionSecretOptions {
  configured: string | undefined;
  isProduction: boolean;
  generate: () => string;
}

// No secret in the source code: production must configure a strong SESSION_SECRET, while
// dev/test get a random per-process secret (sessions end at restart, but tokens can never
// be forged from values published in the repository).
export function resolveSessionSecret({
  configured,
  isProduction,
  generate,
}: SessionSecretOptions): string {
  if (configured !== undefined) {
    if (isProduction && configured.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `SESSION_SECRET is too weak for production — use at least ${MIN_PRODUCTION_SECRET_LENGTH} characters.`,
      );
    }
    return configured;
  }
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET must be set to a strong value in production (e.g. `openssl rand -base64 48`).",
    );
  }
  return generate();
}

const globalStore = globalThis as { __coderShopDevSessionSecret?: string };

export function sessionSecret(): string {
  return resolveSessionSecret({
    configured: env.SESSION_SECRET,
    isProduction: process.env.NODE_ENV === "production",
    generate: () =>
      (globalStore.__coderShopDevSessionSecret ??= randomBytes(32).toString("base64url")),
  });
}

export interface SessionPayload {
  userId: string;
  exp: number;
  /** Issued-at (ms epoch); tokens older than the user's `sessionsInvalidBefore` are revoked. */
  iat?: number;
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
  if (payload.iat !== undefined && typeof payload.iat !== "number") return null;
  if (payload.exp <= now) return null;
  return payload;
}

export function createSessionToken(userId: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const iat = Date.now();
  return signSessionToken({ userId, iat, exp: iat + ttlSeconds * 1000 });
}
