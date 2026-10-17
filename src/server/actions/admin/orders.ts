"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ORDER_STATUSES, IllegalTransitionError, type OrderStatus } from "@/lib/orders/state-machine";
import { transitionOrderCore } from "@/server/orders-admin";
import { requireAdminSession } from "@/server/session";

export interface TransitionActionState {
  ok?: boolean;
  error?: string;
}

const transitionSchema = z.object({
  orderId: z.string().min(1),
  to: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  note: z.string().trim().max(200).optional(),
});

const CANCEL_NOTE = "Storniert, Lager gutgeschrieben";

export async function transitionOrderAction(
  _previous: TransitionActionState | null,
  formData: FormData,
): Promise<TransitionActionState> {
  await requireAdminSession();

  const parsed = transitionSchema.safeParse({
    orderId: formData.get("orderId"),
    to: formData.get("to"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const { orderId, to, note } = parsed.data;
  try {
    const result = await transitionOrderCore(orderId, to, {
      note: to === "cancelled" ? (note ?? CANCEL_NOTE) : note,
      by: "admin@codershop.ch",
    });
    if (!result.ok) return { error: result.error };
  } catch (error) {
    if (error instanceof IllegalTransitionError) {
      return { error: "Dieser Statuswechsel ist nicht erlaubt." };
    }
    return { error: "Statuswechsel fehlgeschlagen. Bitte erneut versuchen." };
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/[id]", "page");
  revalidatePath("/admin/packing");
  revalidatePath("/admin/packing/[id]", "page");
  return { ok: true };
}
