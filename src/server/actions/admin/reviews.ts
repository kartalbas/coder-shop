"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { label } from "@/lib/i18n";
import { objectIdSchema } from "@/lib/validations/common";
import { REVIEW_STATUSES } from "@/lib/reviews";
import { getRequestLabels } from "@/server/i18n";
import { replyToReviewCore, setReviewStatusCore } from "@/server/reviews";
import { requireAdminSession } from "@/server/session";

// Review moderation (issue #47): approve, hide and answer — behind the admin session.
// #58 step 5: the boundary refusals come from the table in the request language.

export interface ReviewAdminActionState {
  ok?: boolean;
  error?: string;
}

const statusSchema = z.object({
  reviewId: objectIdSchema,
  status: z.enum(REVIEW_STATUSES),
});

export async function setReviewStatusAction(
  _previous: ReviewAdminActionState | null,
  formData: FormData,
): Promise<ReviewAdminActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  const parsed = statusSchema.safeParse({
    reviewId: formData.get("reviewId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: label(labels, "admin.error.invalidRequest") };
  const result = await setReviewStatusCore(parsed.data.reviewId, parsed.data.status);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/reviews");
  return { ok: true };
}

// The reply schema is a label-map factory: the same rows the moderation UI shows.
function createReplySchema(labels: Record<string, string>) {
  return z.object({
    reviewId: objectIdSchema,
    text: z
      .string()
      .trim()
      .min(3, label(labels, "admin.reviews.error.replyRequired"))
      .max(2000),
  });
}

export async function replyToReviewAction(
  _previous: ReviewAdminActionState | null,
  formData: FormData,
): Promise<ReviewAdminActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  const parsed = createReplySchema(labels).safeParse({
    reviewId: formData.get("reviewId"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? label(labels, "admin.error.invalidRequest") };
  }
  const result = await replyToReviewCore(parsed.data.reviewId, parsed.data.text);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/reviews");
  return { ok: true };
}
