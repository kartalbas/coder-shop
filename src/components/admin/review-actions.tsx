"use client";

import { useActionState } from "react";
import { EyeOff, Loader2, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";
import {
  replyToReviewAction,
  setReviewStatusAction,
  type ReviewAdminActionState,
} from "@/server/actions/admin/reviews";

// Moderation controls for one review (issue #47): approve, hide and a public answer.
export function ReviewActions({ reviewId, status }: { reviewId: string; status: string }) {
  const labels = useLabels();
  const [statusState, statusAction, statusPending] = useActionState<
    ReviewAdminActionState | null,
    FormData
  >(setReviewStatusAction, null);
  const [replyState, replyAction, replyPending] = useActionState<
    ReviewAdminActionState | null,
    FormData
  >(replyToReviewAction, null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "approved" && (
          <form action={statusAction} className="flex items-center gap-2">
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="status" value="approved" />
            <Button type="submit" size="sm" disabled={statusPending}>
              {statusPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
              {label(labels, "admin.reviews.action.approve")}
            </Button>
          </form>
        )}
        {status !== "hidden" && (
          <form action={statusAction} className="flex items-center gap-2">
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="status" value="hidden" />
            <Button type="submit" size="sm" variant="outline" disabled={statusPending}>
              <EyeOff className="size-3.5" aria-hidden />
              {label(labels, "admin.reviews.action.hide")}
            </Button>
          </form>
        )}
        {statusState?.error && (
          <p className="text-xs text-destructive" role="alert">
            {statusState.error}
          </p>
        )}
      </div>
      <form action={replyAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="reviewId" value={reviewId} />
        <Input
          name="text"
          placeholder={label(labels, "admin.reviews.reply.placeholder")}
          maxLength={2000}
          className="h-8 w-56"
          aria-label={label(labels, "admin.reviews.reply.aria")}
        />
        <Button type="submit" size="sm" variant="outline" disabled={replyPending}>
          {replyPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-3.5" aria-hidden />
          )}
          {label(labels, "admin.reviews.action.reply")}
        </Button>
        {replyState?.error && (
          <p className="text-xs text-destructive" role="alert">
            {replyState.error}
          </p>
        )}
      </form>
    </div>
  );
}
