"use server";

import { z } from "zod";
import { label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { grantOrderAccess, verifyOrderEmailCore } from "@/server/order-access";

export interface OrderAccessActionState {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  orderNumber: z.string().regex(/^B-\d{4}-\d{6}$/),
  email: z.email(),
});

export async function verifyOrderEmailAction(
  _previous: OrderAccessActionState | null,
  formData: FormData,
): Promise<OrderAccessActionState> {
  const parsed = schema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: label(await getRequestLabels(), "shop.action.orderAccessEmail"),
    };
  }
  const result = await verifyOrderEmailCore(parsed.data.orderNumber, parsed.data.email);
  if (!result.ok) return { ok: false, error: result.error };
  await grantOrderAccess(parsed.data.orderNumber);
  return { ok: true };
}
