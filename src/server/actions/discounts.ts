"use server";

import { z } from "zod";
import { checkDiscountCore } from "@/server/discounts";
import { getCustomerSessionUserId } from "@/server/session";

export interface DiscountValidation {
  ok: boolean;
  discountCents?: number;
  error?: string;
}

const inputSchema = z.object({
  code: z.string().trim().max(32),
  subtotalCents: z.number().int().min(0).max(100_000_000),
});

// Live feedback for the cart/checkout code field (issue #45). The per-customer rule is
// checked against the logged-in account when there is one; the checkout re-validates
// against the actual customer inside the transaction, so this is only feedback.
export async function validateDiscountAction(
  rawCode: string,
  rawSubtotal: number,
): Promise<DiscountValidation> {
  const parsed = inputSchema.safeParse({ code: rawCode, subtotalCents: rawSubtotal });
  if (!parsed.success) return { ok: false, error: "Dieser Gutscheincode ist ungültig." };
  const userId = (await getCustomerSessionUserId().catch(() => null)) ?? undefined;
  const check = await checkDiscountCore(parsed.data.code, parsed.data.subtotalCents, userId);
  if (!check.ok) return { ok: false, error: check.error };
  return { ok: true, discountCents: check.discountCents };
}
