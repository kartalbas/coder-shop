import { UserModel } from "@/models/user";
import { connectDB } from "./db";
import { env } from "./env";
import { verifyPassword } from "./password";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "./session-token";

export {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionSecret,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

interface ThrottleEntry {
  failures: number;
  windowStart: number;
}

// Validly formatted scrypt hash that can never match — verified for unknown accounts so
// response time does not reveal whether an e-mail exists.
const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$" + "0".repeat(32) + "$" + "0".repeat(64);

const THROTTLE_MAX_ATTEMPTS = 5;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_SWEEP_SIZE = 1000;

const throttle = new Map<string, ThrottleEntry>();

export function resetLoginThrottle(): void {
  throttle.clear();
}

function throttleSweep(): void {
  if (throttle.size < THROTTLE_SWEEP_SIZE) return;
  for (const [key, entry] of throttle) {
    if (Date.now() - entry.windowStart > THROTTLE_WINDOW_MS) throttle.delete(key);
  }
}

function throttleCheck(key: string): { blocked: boolean; retryInSeconds: number } {
  const entry = throttle.get(key);
  if (!entry) return { blocked: false, retryInSeconds: 0 };
  if (Date.now() - entry.windowStart > THROTTLE_WINDOW_MS) {
    throttle.delete(key);
    return { blocked: false, retryInSeconds: 0 };
  }
  if (entry.failures >= THROTTLE_MAX_ATTEMPTS) {
    const retryInSeconds = Math.ceil(
      (entry.windowStart + THROTTLE_WINDOW_MS - Date.now()) / 1000,
    );
    return { blocked: true, retryInSeconds };
  }
  return { blocked: false, retryInSeconds: 0 };
}

function throttleRecordFailure(key: string): void {
  throttleSweep();
  const existing = throttle.get(key);
  if (!existing || Date.now() - existing.windowStart > THROTTLE_WINDOW_MS) {
    throttle.set(key, { failures: 1, windowStart: Date.now() });
  } else {
    existing.failures += 1;
  }
}

export type LoginResult =
  | { ok: true; token: string; email: string; name: string }
  | { ok: false; error: string };

export async function loginCore(
  email: string,
  password: string,
  opts: { ip?: string } = {},
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `${opts.ip ?? "local"}|${normalizedEmail}`;
  const blocked = throttleCheck(key);
  if (blocked.blocked) {
    return {
      ok: false,
      error: `Zu viele Fehlversuche. Bitte in ${blocked.retryInSeconds} Sekunden erneut versuchen.`,
    };
  }

  await connectDB();
  const user = await UserModel.findOne({ email: normalizedEmail }).exec();
  // Unknown accounts still pay the scrypt cost (constant-time against user enumeration).
  const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordValid) {
    throttleRecordFailure(key);
    return { ok: false, error: "E-Mail oder Passwort ist falsch." };
  }

  throttle.delete(key);
  return {
    ok: true,
    token: createSessionToken(user._id.toString()),
    email: user.email,
    name: user.name,
  };
}

// A valid signature alone is not enough: the session only counts while the user still
// exists (deleting an admin immediately invalidates their cookies).
export async function resolveSessionUserId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  await connectDB();
  const user = await UserModel.findById(payload.userId).select("_id").lean().exec();
  return user ? payload.userId : null;
}

export async function getSessionUserId(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return resolveSessionUserId(store.get(SESSION_COOKIE)?.value);
}

export async function getAdminEmail(userId: string): Promise<string | null> {
  await connectDB();
  const user = await UserModel.findById(userId).select("email").lean().exec();
  return user?.email ?? null;
}

export async function requireAdminSession(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    const { redirect } = await import("next/navigation");
    return redirect("/admin/login");
  }
  return userId;
}

function protocolOfUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol.replace(/:$/, "");
  } catch {
    return null;
  }
}

// A `Secure` cookie is only stored by browsers on trustworthy origins — over plain HTTP that
// is https plus localhost/127.*, so a production server on a LAN address would silently
// discard the session and bounce the admin back to the login on every click. Decide per
// request: explicit SESSION_COOKIE_SECURE wins, else the request's own protocol (proxy
// hint first, then the browser's Origin/Referer), else the old NODE_ENV default.
export async function resolveSessionCookieSecure(): Promise<boolean> {
  if (env.sessionCookieSecure !== undefined) return env.sessionCookieSecure;
  const { headers } = await import("next/headers");
  const all = await headers();
  const forwarded = all.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwarded || protocolOfUrl(all.get("origin")) || protocolOfUrl(all.get("referer"));
  if (protocol) return protocol === "https";
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await resolveSessionCookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
