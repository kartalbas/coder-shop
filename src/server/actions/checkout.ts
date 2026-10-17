"use server";

import { checkoutSchema } from "@/lib/validations/checkout";
import { createOrderCore } from "@/server/checkout";

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

  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.",
    };
  }

  const result = await createOrderCore(parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, orderNumber: result.orderNumber };
}
