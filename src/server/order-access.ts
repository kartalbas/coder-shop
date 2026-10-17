import { createHmac, timingSafeEqual } from "node:crypto";
import { OrderModel } from "@/models/order";
import { connectDB } from "./db";
import { resolveSessionCookieSecure } from "./session";
import { sessionSecret } from "./session-token";

// Order numbers are sequential and therefore guessable, so the confirmation page is only
// fully rendered for a browser holding a per-order access cookie (granted at checkout) or
// for a signed-in admin. Everyone else must confirm the order's e-mail address first.

export const ORDER_ACCESS_COOKIE_PREFIX = "order_access_";
export const ORDER_ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;

export function orderAccessCookieName(orderNumber: string): string {
  return `${ORDER_ACCESS_COOKIE_PREFIX}${orderNumber}`;
}

export function signOrderAccessToken(orderNumber: string, secret = sessionSecret()): string {
  return createHmac("sha256", secret)
    .update(`order-access:${orderNumber}`)
    .digest("base64url");
}

export function verifyOrderAccessToken(
  orderNumber: string,
  token: string | undefined,
  secret = sessionSecret(),
): boolean {
  if (!token) return false;
  const expected = Buffer.from(signOrderAccessToken(orderNumber, secret));
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function grantOrderAccess(orderNumber: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(orderAccessCookieName(orderNumber), signOrderAccessToken(orderNumber), {
    httpOnly: true,
    sameSite: "lax",
    secure: await resolveSessionCookieSecure(),
    path: "/",
    maxAge: ORDER_ACCESS_TTL_SECONDS,
  });
}

export async function hasOrderAccess(orderNumber: string): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return verifyOrderAccessToken(orderNumber, store.get(orderAccessCookieName(orderNumber))?.value);
}

const EMAIL_THROTTLE_MAX_FAILURES = 10;
const EMAIL_THROTTLE_WINDOW_MS = 60 * 60 * 1000;

const emailThrottle = new Map<string, { failures: number; windowStart: number }>();

export function resetOrderEmailThrottle(): void {
  emailThrottle.clear();
}

function emailThrottleBlocked(orderNumber: string): boolean {
  const entry = emailThrottle.get(orderNumber);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > EMAIL_THROTTLE_WINDOW_MS) {
    emailThrottle.delete(orderNumber);
    return false;
  }
  return entry.failures >= EMAIL_THROTTLE_MAX_FAILURES;
}

function emailThrottleRecordFailure(orderNumber: string): void {
  const existing = emailThrottle.get(orderNumber);
  if (!existing || Date.now() - existing.windowStart > EMAIL_THROTTLE_WINDOW_MS) {
    emailThrottle.set(orderNumber, { failures: 1, windowStart: Date.now() });
  } else {
    existing.failures += 1;
  }
}

const EMAIL_MISMATCH = "Bestellung und E-Mail-Adresse stimmen nicht überein.";

export async function verifyOrderEmailCore(
  orderNumber: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (emailThrottleBlocked(orderNumber)) {
    return { ok: false, error: "Zu viele Fehlversuche. Bitte später erneut versuchen." };
  }
  await connectDB();
  const order = await OrderModel.findOne({ orderNumber }).select("customer.email").lean().exec();
  const expected = order?.customer.email.trim().toLowerCase();
  const provided = email.trim().toLowerCase();
  if (!expected || !provided || expected !== provided) {
    emailThrottleRecordFailure(orderNumber);
    return { ok: false, error: EMAIL_MISMATCH };
  }
  emailThrottle.delete(orderNumber);
  return { ok: true };
}
