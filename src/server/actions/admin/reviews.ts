"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import { REVIEW_STATUSES } from "@/lib/reviews";
import { replyToReviewCore, setReviewStatusCore } from "@/server/reviews";
import { requireAdminSession } from "@/server/session";

// Review moderation (issue #47): approve, hide and answer — behind the admin session.

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
  const parsed = statusSchema.safeParse({
    reviewId: formData.get("reviewId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };
  const result = await setReviewStatusCore(parsed.data.reviewId, parsed.data.status);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/reviews");
  return { ok: true };
}

const replySchema = z.object({
  reviewId: objectIdSchema,
  text: z.string().trim().min(3, "Bitte eine Antwort schreiben.").max(2000),
});

export async function replyToReviewAction(
  _previous: ReviewAdminActionState | null,
  formData: FormData,
): Promise<ReviewAdminActionState> {
  await requireAdminSession();
  const parsed = replySchema.safeParse({
    reviewId: formData.get("reviewId"),
    text: formData.get("text"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Anfrage." };
  const result = await replyToReviewCore(parsed.data.reviewId, parsed.data.text);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/reviews");
  return { ok: true };
}
