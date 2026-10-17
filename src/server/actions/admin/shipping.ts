"use server";

import { revalidatePath } from "next/cache";
import { objectIdSchema } from "@/lib/validations/common";
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

  const orderId = objectIdSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "Ungültige Anfrage." };

  const result = await createLabelCore(orderId.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/[id]", "page");
  revalidatePath("/admin/packing");
  revalidatePath("/admin/packing/[id]", "page");
  return { ok: true, trackingNumber: result.trackingNumber };
}
