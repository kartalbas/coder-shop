"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import {
  adminResetPasswordCore,
  setCustomerBlockedCore,
  setCustomerNotesCore,
} from "@/server/customers-admin";
import { requireAdminSession } from "@/server/session";

export interface CustomerActionState {
  ok?: boolean;
  error?: string;
}

// Issue #43: every customer-management action validates its input at the boundary
// (junk means "no action", never a 500) and requires the admin session.
const blockSchema = z.object({
  customerId: objectIdSchema,
  blocked: z.boolean(),
});

const notesSchema = z.object({
  customerId: objectIdSchema,
  notes: z.string().max(2000),
});

export async function setCustomerBlockedAction(
  _previous: CustomerActionState | null,
  formData: FormData,
): Promise<CustomerActionState> {
  await requireAdminSession();
  const parsed = blockSchema.safeParse({
    customerId: formData.get("customerId"),
    blocked: formData.get("blocked") === "true",
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };
  const result = await setCustomerBlockedCore(parsed.data.customerId, parsed.data.blocked);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${parsed.data.customerId}`);
  return { ok: true };
}

export async function setCustomerNotesAction(
  _previous: CustomerActionState | null,
  formData: FormData,
): Promise<CustomerActionState> {
  await requireAdminSession();
  const parsed = notesSchema.safeParse({
    customerId: formData.get("customerId"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };
  const result = await setCustomerNotesCore(parsed.data.customerId, parsed.data.notes);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/admin/customers/${parsed.data.customerId}`);
  return { ok: true };
}

export async function adminResetPasswordAction(
  _previous: CustomerActionState | null,
  formData: FormData,
): Promise<CustomerActionState> {
  await requireAdminSession();
  const parsed = objectIdSchema.safeParse(formData.get("customerId"));
  if (!parsed.success) return { error: "Ungültige Anfrage." };
  const result = await adminResetPasswordCore(parsed.data);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
