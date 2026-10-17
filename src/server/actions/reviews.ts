"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import { submitReviewCore } from "@/server/reviews";
import { getCustomerSessionUserId } from "@/server/session";

// Review submission (issue #47) — a customer session is required, and the core
// additionally demands a real purchase of the product.

export interface ReviewActionState {
  ok?: boolean;
  error?: string;
}

const reviewSchema = z.object({
  productId: objectIdSchema,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Bitte schreiben Sie ein paar Worte.").max(2000),
});

export async function submitReviewAction(
  _previous: ReviewActionState | null,
  formData: FormData,
): Promise<ReviewActionState> {
  const userId = await getCustomerSessionUserId();
  if (!userId) {
    return { error: "Bitte melden Sie sich an, um eine Bewertung zu schreiben." };
  }
  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const result = await submitReviewCore({ userId, ...parsed.data });
  if (!result.ok) return { error: result.error };
  if (result.slug) revalidatePath(`/products/${result.slug}`);
  return { ok: true };
}
