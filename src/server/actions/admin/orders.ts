"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { label } from "@/lib/i18n";
import { ORDER_STATUSES, IllegalTransitionError, type OrderStatus } from "@/lib/orders/state-machine";
import { objectIdSchema } from "@/lib/validations/common";
import { getRequestLabels } from "@/server/i18n";
import { transitionOrderCore } from "@/server/orders-admin";
import { getAdminEmail, requireAdminSession } from "@/server/session";

export interface TransitionActionState {
  ok?: boolean;
  error?: string;
}

const transitionSchema = z.object({
  orderId: objectIdSchema,
  to: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  note: z.string().trim().max(200).optional(),
});

const CANCEL_NOTE = "Storniert, Lager gutgeschrieben";

export async function transitionOrderAction(
  _previous: TransitionActionState | null,
  formData: FormData,
): Promise<TransitionActionState> {
  const userId = await requireAdminSession();
  const adminEmail = await getAdminEmail(userId);
  // Issue #58 step 2: refusals answer in the admin's request language; the stored
  // CANCEL_NOTE stays German (recorded boundary — statusLog notes are stored data).
  const labels = await getRequestLabels();

  const parsed = transitionSchema.safeParse({
    orderId: formData.get("orderId"),
    to: formData.get("to"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: label(labels, "admin.error.invalidRequest") };

  const { orderId, to, note } = parsed.data;
  try {
    const result = await transitionOrderCore(orderId, to, {
      note: to === "cancelled" ? (note ?? CANCEL_NOTE) : note,
      by: adminEmail ?? "admin",
    });
    if (!result.ok) return { error: result.error };
  } catch (error) {
    if (error instanceof IllegalTransitionError) {
      return { error: label(labels, "admin.orders.error.illegalTransition") };
    }
    return { error: label(labels, "admin.orders.error.failed") };
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/[id]", "page");
  revalidatePath("/admin/packing");
  revalidatePath("/admin/packing/[id]", "page");
  return { ok: true };
}
