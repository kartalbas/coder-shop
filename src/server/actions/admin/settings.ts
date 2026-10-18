"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { label, type LabelMap } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { saveShopSettingsCore } from "@/server/shop-settings";
import { requireAdminSession } from "@/server/session";

export interface ShopSettingsActionState {
  ok?: boolean;
  error?: string;
}

// Issue #58 step 3: the schema is a label-map factory — every message comes from the
// translation table in the request language. Amounts arrive in CHF (the form's input
// convention), positions as row order.
function createShopSettingsSchema(labels: LabelMap) {
  const methodKey = z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]*$/, label(labels, "admin.settings.validation.keyShape"));
  const chfToCents = z
    .string()
    .trim()
    .regex(/^\d{1,7}([.,]\d{1,2})?$/, label(labels, "admin.settings.validation.amount"))
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100));
  return z.object({
    vatRatePercent: z.coerce
      .number(label(labels, "admin.settings.validation.percent"))
      .min(0)
      .max(100),
    freeShippingFromCents: chfToCents,
    shippingMethods: z
      .array(
        z.object({
          key: methodKey,
          label: z.string().trim().min(1, label(labels, "admin.settings.validation.nameRequired")),
          priceChf: chfToCents,
          hint: z.string().trim().max(80),
          storePickup: z.boolean(),
          expressService: z.boolean(),
          active: z.boolean(),
        }),
      )
      .min(1, label(labels, "admin.settings.validation.shippingRequired")),
    paymentMethods: z
      .array(
        z.object({
          key: methodKey,
          label: z.string().trim().min(1, label(labels, "admin.settings.validation.nameRequired")),
          kind: z.enum(["immediate", "invoice", "on_pickup"]),
          active: z.boolean(),
        }),
      )
      .min(1, label(labels, "admin.settings.validation.paymentRequired")),
  });
}

// Issue #64: the admin edits the commerce configuration; positions are the row order.
export async function saveShopSettingsAction(
  _previous: ShopSettingsActionState | null,
  formData: FormData,
): Promise<ShopSettingsActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: label(labels, "admin.error.invalidRequest") };
  }
  const parsed = createShopSettingsSchema(labels).safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? label(labels, "admin.error.invalidRequest"),
    };
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
      expressService: method.expressService,
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
