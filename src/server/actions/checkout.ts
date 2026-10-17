"use server";

import { headers } from "next/headers";
import { env } from "@/server/env";
import { createRateLimiter } from "@/server/rate-limit";
import { resolveClientIp } from "@/server/session";
import { createOrderCore } from "@/server/checkout";
import { grantOrderAccess } from "@/server/order-access";

// Anti-abuse (issue #8): scripted checkouts must not drain stock and flood the order list.
// Without a trusted proxy all clients share one bucket — 10 orders per 10 minutes is far
// above any real human usage of this demo shop.
const checkoutLimit = createRateLimiter(10, 10 * 60 * 1000);

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
  const all = await headers();
  const ip = resolveClientIp((name) => all.get(name), env.trustProxyHeaders);
  const limit = checkoutLimit.check(ip);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Zu viele Bestellungen in kurzer Folge. Bitte in ${limit.retryInSeconds} Sekunden erneut versuchen.`,
    };
  }

  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return { ok: false, error: "Ungültige Formular-Daten." };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Ungültige Formular-Daten." };
  }

  // createOrderCore validates the payload with the same zod schema — no second parse here.
  const result = await createOrderCore(json);
  if (!result.ok) {
    return { ok: false, error: result.error, reason: result.reason, changed: result.changed };
  }
  // The buyer's browser gets the cookie that unlocks the confirmation page.
  await grantOrderAccess(result.orderNumber);
  return { ok: true, orderNumber: result.orderNumber };
}
