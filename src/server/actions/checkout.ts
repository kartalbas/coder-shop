"use server";

import { headers } from "next/headers";
import { interpolate, label } from "@/lib/i18n";
import { env } from "@/server/env";
import { getRequestLabels } from "@/server/i18n";
import { createRateLimiter } from "@/server/rate-limit";
import { getCustomerSessionUserId, resolveClientIp } from "@/server/session";
import { createOrderCore } from "@/server/checkout";
import { grantOrderAccess } from "@/server/order-access";

// Anti-abuse (issue #8): scripted checkouts must not drain stock and flood the order
// list. Without a trusted proxy all clients share one bucket — the ceiling (default 10
// orders per 10 minutes) is configuration (#58), far above any real human usage of this
// demo shop and raisable by the e2e suite, which legitimately orders from one IP.
const checkoutLimit = createRateLimiter(env.checkoutLimitPer10Min, 10 * 60 * 1000);

export interface CheckoutActionState {
  ok: boolean;
  error?: string;
  orderNumber?: string;
  reason?: "price_changed";
  changed?: { sku: string; unitPriceCents: number }[];
}

export async function createOrderAction(
  _previous: CheckoutActionState | null,
  formData: FormData,
): Promise<CheckoutActionState> {
  const labels = await getRequestLabels();
  const all = await headers();
  const ip = resolveClientIp((name) => all.get(name), env.trustProxyHeaders);
  const limit = checkoutLimit.check(ip);
  if (!limit.allowed) {
    return {
      ok: false,
      error: interpolate(label(labels, "shop.action.rateLimited"), {
        seconds: limit.retryInSeconds,
      }),
    };
  }

  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, error: label(labels, "shop.action.invalidForm") };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: label(labels, "shop.action.invalidForm") };
  }

  // Issue #39: a logged-in customer's orders belong to their account — the user id comes
  // from the session, never from the client payload.
  const userId = (await getCustomerSessionUserId()) ?? undefined;
  // createOrderCore validates the payload with the same zod schema — no second parse here.
  const result = await createOrderCore(json, { userId });
  if (!result.ok) {
    return { ok: false, error: result.error, reason: result.reason, changed: result.changed };
  }
  // The buyer's browser gets the cookie that unlocks the confirmation page.
  await grantOrderAccess(result.orderNumber);
  return { ok: true, orderNumber: result.orderNumber };
}
