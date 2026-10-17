import { UserModel } from "@/models/user";
import { connectDB } from "./db";
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

const THROTTLE_MAX_ATTEMPTS = 5;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

const throttle = new Map<string, ThrottleEntry>();

export function resetLoginThrottle(): void {
  throttle.clear();
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
  const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;
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

export async function getSessionUserId(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifySessionToken(raw)?.userId ?? null;
}

export async function requireAdminSession(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    const { redirect } = await import("next/navigation");
    return redirect("/admin/login");
  }
  return userId;
}

export async function setSessionCookie(token: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
