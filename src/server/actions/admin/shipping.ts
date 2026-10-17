"use server";

import { revalidatePath } from "next/cache";
import { createLabelCore } from "@/server/shipping/label";
import { requireAdminSession } from "@/server/session";

export interface CreateLabelActionState {
  ok?: boolean;
  error?: string;
  trackingNumber?: string;
}

export async function createLabelAction(
  _previous: CreateLabelActionState | null,
  formData: FormData,
): Promise<CreateLabelActionState> {
  await requireAdminSession();

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || orderId.length === 0) {
    return { error: "Ungültige Anfrage." };
  }

  const result = await createLabelCore(orderId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/[id]", "page");
  revalidatePath("/admin/packing");
  revalidatePath("/admin/packing/[id]", "page");
  return { ok: true, trackingNumber: result.trackingNumber };
}
