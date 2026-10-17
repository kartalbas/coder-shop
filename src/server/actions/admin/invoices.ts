"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
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

// Amounts are entered in CHF with up to 2 decimals and booked as integer cents.
const amountChfSchema = z
  .string()
  .trim()
  .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Bitte einen gültigen Betrag angeben.")
  .transform((value) => Math.round(Number(value.replace(",", ".")) * 100));

const paymentSchema = z.object({
  orderId: objectIdSchema,
  amountCents: amountChfSchema,
});

export async function recordInvoicePaymentAction(
  _previous: InvoiceActionState | null,
  formData: FormData,
): Promise<InvoiceActionState> {
  const userId = await requireAdminSession();
  const adminEmail = (await getAdminEmail(userId)) ?? "admin";

  const parsed = paymentSchema.safeParse({
    orderId: formData.get("orderId"),
    amountCents: formData.get("amount"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const result = await recordInvoicePaymentCore(parsed.data.orderId, parsed.data.amountCents, adminEmail);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/invoices");
  revalidatePath("/konto/rechnungen");
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

  const parsed = reminderSchema.safeParse({
    orderId: formData.get("orderId"),
    level: formData.get("level"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const result = await sendInvoiceReminderCore(parsed.data.orderId, parsed.data.level);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/invoices");
  return { ok: true };
}

const creditLimitSchema = z.object({
  userId: objectIdSchema,
  amountCents: amountChfSchema,
});

export async function setCreditLimitAction(
  _previous: InvoiceActionState | null,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireAdminSession();

  const parsed = creditLimitSchema.safeParse({
    userId: formData.get("userId"),
    amountCents: formData.get("amount"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const result = await setCreditLimitCore(parsed.data.userId, parsed.data.amountCents);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/invoices");
  return { ok: true };
}
