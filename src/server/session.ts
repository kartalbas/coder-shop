import { UserModel, type UserRole } from "@/models/user";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { interpolate, label } from "@/lib/i18n";
import { getRequestLabels } from "./i18n";
import { connectDB } from "./db";
import { env } from "./env";
import { verifyPassword, hashPassword } from "./password";
import { createLimiter, LimiterBusyError } from "./limiter";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionScopeOf,
  verifySessionToken,
  type SessionScope,
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

// scrypt costs ~32 MiB per verification — bound the parallelism and shed load instead of
// letting a scripted parallel login exhaust the machine.
const scryptLimiter = createLimiter(2, 8);

// `X-Forwarded-For` is client-controlled unless the request really came through our own
// reverse proxy (TRUST_PROXY_HEADERS=true). Without that, every header value would be a
// fresh "IP" and the throttle meaningless — so the IP is then a single shared bucket and
// the per-account throttle (which headers cannot influence) does the work.
export function resolveClientIp(
  header: (name: string) => string | null,
  trustProxy: boolean,
): string {
  if (!trustProxy) return "unknown";
  const forwarded = header("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    // Our own proxy appends the real peer address last; earlier entries may be spoofed.
    const last = entries[entries.length - 1];
    if (last) return last;
  }
  return header("x-real-ip") || "unknown";
}

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

function scopeOfRole(role: UserRole): SessionScope {
  return role === "admin" ? "admin" : "customer";
}

// Shared by admin and customer login. `role` is part of the throttle key and the
// credential check: a customer password never opens the admin area and an admin
// e-mail never logs into the customer portal (both fail as "wrong credentials").
async function authenticate(
  email: string,
  password: string,
  role: UserRole,
  opts: { ip?: string } = {},
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  // The account bucket cannot be rotated with request headers; the IP bucket additionally
  // limits one client hammering several accounts.
  const keys = [
    `acct|${role}|${normalizedEmail}`,
    `${opts.ip ?? "local"}|${role}|${normalizedEmail}`,
  ];
  for (const key of keys) {
    const blocked = throttleCheck(key);
    if (blocked.blocked) {
      const labels = await getRequestLabels();
      return {
        ok: false,
        error: interpolate(label(labels, "admin.auth.error.throttled"), {
          seconds: blocked.retryInSeconds,
        }),
      };
    }
  }

  await connectDB();
  const user = await UserModel.findOne({ email: normalizedEmail, role }).exec();
  // Unknown accounts still pay the scrypt cost (constant-time against user enumeration).
  let passwordValid: boolean;
  try {
    passwordValid = await scryptLimiter.run(() =>
      verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH),
    );
  } catch (error) {
    if (error instanceof LimiterBusyError) {
      const labels = await getRequestLabels();
      return { ok: false, error: label(labels, "admin.auth.error.busy") };
    }
    throw error;
  }
  if (!user || !passwordValid) {
    for (const key of keys) throttleRecordFailure(key);
    const labels = await getRequestLabels();
    return { ok: false, error: label(labels, "admin.auth.error.wrongCredentials") };
  }
  // Issue #43: only the correct password reveals the block — unknown or wrong-credential
  // accounts keep answering the generic message.
  if (user.blocked) {
    const labels = await getRequestLabels();
    return { ok: false, error: label(labels, "admin.auth.error.blocked") };
  }

  for (const key of keys) throttle.delete(key);
  const scope = scopeOfRole(role);
  return {
    ok: true,
    token: createSessionToken(
      user._id.toString(),
      scope === "customer" ? CUSTOMER_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
      scope,
    ),
    email: user.email,
    name: user.name,
  };
}

export function loginCore(
  email: string,
  password: string,
  opts: { ip?: string } = {},
): Promise<LoginResult> {
  return authenticate(email, password, "admin", opts);
}

export function customerLoginCore(
  email: string,
  password: string,
  opts: { ip?: string } = {},
): Promise<LoginResult> {
  return authenticate(email, password, "customer", opts);
}

// A valid signature alone is not enough: the session only counts while the user still
// exists (deleting an admin immediately invalidates their cookies) and while the token's
// scope and the user's role agree — a customer cookie never authenticates the admin area.
export async function resolveSessionUserId(
  token: string | undefined,
  scope: SessionScope,
): Promise<string | null> {
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload || sessionScopeOf(payload) !== scope) return null;
  await connectDB();
  const user = await UserModel.findById(payload.userId)
    .select("_id role sessionsInvalidBefore")
    .lean()
    .exec();
  if (!user || scopeOfRole(user.role) !== scope) return null;
  if (user.sessionsInvalidBefore && (payload.iat ?? 0) < user.sessionsInvalidBefore.getTime()) {
    return null;
  }
  return payload.userId;
}

// Logout / forced sign-out: every token issued before now stops working, even a captured
// copy of the cookie (the LAN mode serves plain HTTP).
export async function revokeSessionsCore(userId: string): Promise<void> {
  await connectDB();
  await UserModel.updateOne({ _id: userId }, { $set: { sessionsInvalidBefore: new Date() } });
}

// The seeded password can only be set at first seed; this is the way to change it later.
// `reason` tells the calling form which field the error belongs to (issue #60).
export async function changePasswordCore(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<
  { ok: true } | { ok: false; error: string; reason?: "new_password" | "current_password" }
> {
  const labels = await getRequestLabels();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: interpolate(label(labels, "admin.auth.error.passwordTooShort"), {
        min: MIN_PASSWORD_LENGTH,
      }),
      reason: "new_password",
    };
  }
  await connectDB();
  const user = await UserModel.findById(userId).exec();
  if (!user) return { ok: false, error: label(labels, "admin.auth.error.userNotFound") };
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return {
      ok: false,
      error: label(labels, "admin.auth.error.currentPasswordWrong"),
      reason: "current_password",
    };
  }
  user.passwordHash = await hashPassword(newPassword);
  // A password change also signs out every existing session.
  user.sessionsInvalidBefore = new Date();
  await user.save();
  return { ok: true };
}

function sessionCookieName(scope: SessionScope): string {
  return scope === "customer" ? CUSTOMER_SESSION_COOKIE : SESSION_COOKIE;
}

function sessionTtl(scope: SessionScope): number {
  return scope === "customer" ? CUSTOMER_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
}

export async function getSessionUserId(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return resolveSessionUserId(store.get(SESSION_COOKIE)?.value, "admin");
}

export async function getCustomerSessionUserId(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return resolveSessionUserId(store.get(CUSTOMER_SESSION_COOKIE)?.value, "customer");
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

export async function requireCustomerSession(): Promise<string> {
  const userId = await getCustomerSessionUserId();
  if (!userId) {
    const { redirect } = await import("next/navigation");
    return redirect("/account/login");
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
// request: explicit SESSION_COOKIE_SECURE wins, else the request's own protocol, else the
// old NODE_ENV default. `x-forwarded-proto` is only consulted behind a trusted proxy —
// Next fills it in itself with `http` when a TLS proxy does not send it, which would strip
// `Secure` on an https site.
export function decideSessionCookieSecure(input: {
  explicit: boolean | undefined;
  forwardedProto: string | undefined;
  origin: string | null;
  referer: string | null;
  isProduction: boolean;
}): boolean {
  if (input.explicit !== undefined) return input.explicit;
  const protocol =
    input.forwardedProto || protocolOfUrl(input.origin) || protocolOfUrl(input.referer);
  if (protocol) return protocol === "https";
  return input.isProduction;
}

export async function resolveSessionCookieSecure(): Promise<boolean> {
  const { headers } = await import("next/headers");
  const all = await headers();
  const forwardedProto = env.trustProxyHeaders
    ? all.get("x-forwarded-proto")?.split(",")[0]?.trim()
    : undefined;
  return decideSessionCookieSecure({
    explicit: env.sessionCookieSecure,
    forwardedProto,
    origin: all.get("origin"),
    referer: all.get("referer"),
    isProduction: process.env.NODE_ENV === "production",
  });
}

export async function setSessionCookie(
  token: string,
  scope: SessionScope = "admin",
): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(sessionCookieName(scope), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await resolveSessionCookieSecure(),
    path: "/",
    maxAge: sessionTtl(scope),
  });
}

export async function clearSessionCookie(scope: SessionScope = "admin"): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.delete(sessionCookieName(scope));
}
