"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { label } from "@/lib/i18n";
import { objectIdSchema } from "@/lib/validations/common";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import {
  recordInvoicePaymentCore,
  sendInvoiceReminderCore,
  setCreditLimitCore,
} from "@/server/invoices";
import { getAdminEmail, requireAdminSession } from "@/server/session";

export interface InvoiceActionState {
  ok?: boolean;
  error?: string;
}

// Amounts are entered in CHF with up to 2 decimals and booked as integer cents; the
// refusal is a translation row (#58 step 4), so the schema is a label-map factory.
function createAmountChfSchema(labels: Readonly<Record<string, string>>) {
  return z
    .string()
    .trim()
    .regex(/^\d{1,7}([.,]\d{1,2})?$/, label(labels, "admin.invoices.error.amountFormat"))
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100));
}

export async function recordInvoicePaymentAction(
  _previous: InvoiceActionState | null,
  formData: FormData,
): Promise<InvoiceActionState> {
  const userId = await requireAdminSession();
  const adminEmail = (await getAdminEmail(userId)) ?? "admin";
  const labels = await getRequestLabels();

  const parsed = z
    .object({ orderId: objectIdSchema, amountCents: createAmountChfSchema(labels) })
    .safeParse({
      orderId: formData.get("orderId"),
      amountCents: formData.get("amount"),
    });
  if (!parsed.success) return { error: label(labels, "admin.error.invalidRequest") };

  const result = await recordInvoicePaymentCore(
    parsed.data.orderId,
    parsed.data.amountCents,
    adminEmail,
    // #58 step 6: the refusal amount follows the admin's request language.
    await getRequestFormatters(),
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/invoices");
  revalidatePath("/account/invoices");
  return { ok: true };
}

const reminderSchema = z.object({
  orderId: objectIdSchema,
  level: z.coerce.number().int().refine((level) => level === 1 || level === 2),
});

export async function sendInvoiceReminderAction(
  _previous: InvoiceActionState | null,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();

  const parsed = reminderSchema.safeParse({
    orderId: formData.get("orderId"),
    level: formData.get("level"),
  });
  if (!parsed.success) return { error: label(labels, "admin.error.invalidRequest") };

  const result = await sendInvoiceReminderCore(parsed.data.orderId, parsed.data.level);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/invoices");
  return { ok: true };
}

export async function setCreditLimitAction(
  _previous: InvoiceActionState | null,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();

  const parsed = z
    .object({ userId: objectIdSchema, amountCents: createAmountChfSchema(labels) })
    .safeParse({
      userId: formData.get("userId"),
      amountCents: formData.get("amount"),
    });
  if (!parsed.success) return { error: label(labels, "admin.error.invalidRequest") };

  const result = await setCreditLimitCore(parsed.data.userId, parsed.data.amountCents);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/invoices");
  return { ok: true };
}
