"use server";

import { createOrderCore } from "@/server/checkout";
import { grantOrderAccess } from "@/server/order-access";

export interface CheckoutActionState {
  ok: boolean;
  error?: string;
  orderNumber?: string;
}

export async function createOrderAction(
  _previous: CheckoutActionState | null,
  formData: FormData,
): Promise<CheckoutActionState> {
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
  if (!result.ok) return { ok: false, error: result.error };
  // The buyer's browser gets the cookie that unlocks the confirmation page.
  await grantOrderAccess(result.orderNumber);
  return { ok: true, orderNumber: result.orderNumber };
}
