"use client";

import { useActionState, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLabels } from "@/components/storefront/labels";
import { interpolate, label } from "@/lib/i18n";
import { submitReviewAction, type ReviewActionState } from "@/server/actions/reviews";

// Review form for verified buyers (issue #47). After a successful submit the review
// waits for moderation, so the form says so instead of pretending it is public.
// Issue #58 step 3: every text comes from the translation table.
export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const labels = useLabels();
  const [state, formAction, pending] = useActionState<ReviewActionState | null, FormData>(
    submitReviewAction,
    null,
  );
  const [rating, setRating] = useState(0);

  if (state?.ok) {
    return (
      <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm" role="status">
        {label(labels, "shop.reviews.pending")}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      aria-label={label(labels, "shop.reviews.formTitle")}
      className="space-y-3 rounded-md border bg-muted/30 p-4"
    >
      <h3 className="font-semibold">{label(labels, "shop.reviews.formTitle")}</h3>
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{label(labels, "shop.reviews.ratingLegend")}</legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="relative cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={star}
                required
                checked={rating === star}
                onChange={() => setRating(star)}
                className="sr-only"
                aria-label={interpolate(label(labels, "shop.reviews.starAria"), { star })}
              />
              <Star
                aria-hidden
                className={`size-6 ${
                  star <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"
                } peer-focus-visible:outline-2 peer-focus-visible:outline-ring`}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <Input
        name="title"
        placeholder={label(labels, "shop.reviews.titlePlaceholder")}
        maxLength={120}
        className="h-9"
      />
      <Textarea
        name="body"
        required
        minLength={10}
        maxLength={2000}
        placeholder={interpolate(label(labels, "shop.reviews.bodyPlaceholder"), {
          name: productName,
        })}
        aria-label={label(labels, "shop.reviews.ratingLegend")}
      />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending || rating === 0}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.reviews.submit")}
      </Button>
    </form>
  );
}
