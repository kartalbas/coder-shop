"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PICKUP_PAYMENT_TYPES } from "@/lib/payments";
import { objectIdSchema } from "@/lib/validations/common";
import { handoverPickupCore, markPickupReadyCore } from "@/server/pickup";
import { getAdminEmail, requireAdminSession } from "@/server/session";

export interface PickupActionState {
  ok?: boolean;
  error?: string;
}

const readySchema = z.object({ orderId: objectIdSchema });

export async function markPickupReadyAction(
  _previous: PickupActionState | null,
  formData: FormData,
): Promise<PickupActionState> {
  const userId = await requireAdminSession();
  const adminEmail = (await getAdminEmail(userId)) ?? "admin";

  const parsed = readySchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const result = await markPickupReadyCore(parsed.data.orderId, adminEmail);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/pickup");
  revalidatePath("/admin/orders");
  return { ok: true };
}

const handoverSchema = z.object({
  orderId: objectIdSchema,
  code: z.string().trim().min(4).max(12),
  paymentType: z.enum(PICKUP_PAYMENT_TYPES),
});

export async function handoverPickupAction(
  _previous: PickupActionState | null,
  formData: FormData,
): Promise<PickupActionState> {
  const userId = await requireAdminSession();
  const adminEmail = (await getAdminEmail(userId)) ?? "admin";

  const parsed = handoverSchema.safeParse({
    orderId: formData.get("orderId"),
    code: formData.get("code"),
    paymentType: formData.get("paymentType"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };

  const result = await handoverPickupCore(
    parsed.data.orderId,
    parsed.data.code,
    parsed.data.paymentType,
    adminEmail,
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/pickup");
  revalidatePath("/admin/orders");
  return { ok: true };
}
