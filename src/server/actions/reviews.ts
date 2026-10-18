"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import { label } from "@/lib/i18n";
import { submitReviewCore } from "@/server/reviews";
import { getRequestLabels } from "@/server/i18n";
import { getCustomerSessionUserId } from "@/server/session";

// Review submission (issue #47) — a customer session is required, and the core
// additionally demands a real purchase of the product.

export interface ReviewActionState {
  ok?: boolean;
  error?: string;
}

// #58: the body message is a translation-table row; the productId guard stays the
// generic admin-boundary objectId text (never shown — the form only sends real ids).
function createReviewSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    productId: objectIdSchema,
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional(),
    body: z.string().trim().min(10, label(labels, "shop.validation.field.reviewBody")).max(2000),
  });
}

export async function submitReviewAction(
  _previous: ReviewActionState | null,
  formData: FormData,
): Promise<ReviewActionState> {
  const labels = await getRequestLabels();
  const userId = await getCustomerSessionUserId();
  if (!userId) {
    return { error: label(labels, "shop.action.reviewLogin") };
  }
  const parsed = createReviewSchema(labels).safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm") };
  }
  const result = await submitReviewCore({ userId, ...parsed.data });
  if (!result.ok) return { error: result.error };
  if (result.slug) revalidatePath(`/products/${result.slug}`);
  return { ok: true };
}
