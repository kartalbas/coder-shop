"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import {
  createDiscountCore,
  setDiscountActiveCore,
} from "@/server/discounts";
import { requireAdminSession } from "@/server/session";

export interface DiscountAdminActionState {
  ok?: boolean;
  error?: string;
}

const chfAmount = z
  .string()
  .trim()
  .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Bitte einen gültigen Betrag angeben.")
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 100));

const optionalChf = z
  .string()
  .trim()
  .max(0)
  .transform(() => undefined)
  .or(chfAmount);

const optionalDate = z
  .string()
  .trim()
  .max(0)
  .transform(() => undefined)
  .or(z.coerce.date());

const optionalInt = z
  .string()
  .trim()
  .max(0)
  .transform(() => undefined)
  .or(z.coerce.number().int().min(1).max(1_000_000));

const createSchema = z.object({
  code: z.string().trim().min(3).max(32),
  description: z.string().trim().max(200).optional(),
  kind: z.enum(["percent", "fixed"]),
  percent: z.coerce.number().int().min(1).max(100).optional(),
  amountCents: optionalChf,
  minOrderCents: optionalChf.transform((v) => v ?? 0),
  validFrom: optionalDate,
  validTo: optionalDate,
  usageLimit: optionalInt,
  perCustomerOnce: z.enum(["on", "true"]).optional(),
});

// Issue #45: marketing creates codes here; amounts arrive in CHF and become cents.
export async function createDiscountAction(
  _previous: DiscountAdminActionState | null,
  formData: FormData,
): Promise<DiscountAdminActionState> {
  await requireAdminSession();
  const parsed = createSchema.safeParse({
    code: formData.get("code"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind"),
    percent: formData.get("kind") === "percent" ? formData.get("percent") : undefined,
    amountCents: formData.get("kind") === "fixed" ? formData.get("amountCents") : "",
    minOrderCents: formData.get("minOrderCents") ?? "",
    validFrom: formData.get("validFrom") ?? "",
    validTo: formData.get("validTo") ?? "",
    usageLimit: formData.get("usageLimit") ?? "",
    perCustomerOnce: formData.get("perCustomerOnce") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const result = await createDiscountCore({
    code: parsed.data.code,
    ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    kind: parsed.data.kind,
    ...(parsed.data.percent !== undefined && { percent: parsed.data.percent }),
    ...(parsed.data.amountCents !== undefined && { amountCents: parsed.data.amountCents }),
    minOrderCents: parsed.data.minOrderCents,
    ...(parsed.data.validFrom !== undefined && { validFrom: parsed.data.validFrom }),
    ...(parsed.data.validTo !== undefined && { validTo: parsed.data.validTo }),
    ...(parsed.data.usageLimit !== undefined && { usageLimit: parsed.data.usageLimit }),
    perCustomerOnce: parsed.data.perCustomerOnce !== undefined,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/discounts");
  return { ok: true };
}

const toggleSchema = z.object({
  discountId: objectIdSchema,
  active: z.enum(["true", "false"]),
});

export async function setDiscountActiveAction(
  _previous: DiscountAdminActionState | null,
  formData: FormData,
): Promise<DiscountAdminActionState> {
  await requireAdminSession();
  const parsed = toggleSchema.safeParse({
    discountId: formData.get("discountId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };
  const result = await setDiscountActiveCore(parsed.data.discountId, parsed.data.active === "true");
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/discounts");
  return { ok: true };
}
