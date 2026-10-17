"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveShopSettingsCore } from "@/server/shop-settings";
import { requireAdminSession } from "@/server/session";

export interface ShopSettingsActionState {
  ok?: boolean;
  error?: string;
}

const methodKey = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]*$/, "Keys: Kleinbuchstaben, Ziffern, Bindestriche.");

// Amounts arrive in CHF (the form's input convention), positions as row order.
const chfToCents = z
  .string()
  .trim()
  .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Bitte einen gültigen Betrag angeben.")
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 100));

const shopSettingsSchema = z.object({
  vatRatePercent: z.coerce
    .number("Bitte einen gültigen Prozentsatz angeben.")
    .min(0)
    .max(100),
  freeShippingFromCents: chfToCents,
  shippingMethods: z
    .array(
      z.object({
        key: methodKey,
        label: z.string().trim().min(1, "Name fehlt."),
        priceChf: chfToCents,
        hint: z.string().trim().max(80),
        storePickup: z.boolean(),
        active: z.boolean(),
      }),
    )
    .min(1, "Mindestens eine Versandart ist nötig."),
  paymentMethods: z
    .array(
      z.object({
        key: methodKey,
        label: z.string().trim().min(1, "Name fehlt."),
        kind: z.enum(["immediate", "invoice", "on_pickup"]),
        active: z.boolean(),
      }),
    )
    .min(1, "Mindestens eine Zahlungsart ist nötig."),
});

// Issue #64: the admin edits the commerce configuration; positions are the row order.
export async function saveShopSettingsAction(
  _previous: ShopSettingsActionState | null,
  formData: FormData,
): Promise<ShopSettingsActionState> {
  await requireAdminSession();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Ungültige Eingaben." };
  }
  const parsed = shopSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const result = await saveShopSettingsCore({
    vatRatePercent: parsed.data.vatRatePercent,
    freeShippingFromCents: parsed.data.freeShippingFromCents,
    shippingMethods: parsed.data.shippingMethods.map((method, index) => ({
      key: method.key,
      label: method.label,
      priceCents: method.priceChf,
      position: index + 1,
      active: method.active,
      storePickup: method.storePickup,
      hint: method.hint,
    })),
    paymentMethods: parsed.data.paymentMethods.map((method, index) => ({
      key: method.key,
      label: method.label,
      position: index + 1,
      active: method.active,
      kind: method.kind,
    })),
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/settings");
  return { ok: true };
}
