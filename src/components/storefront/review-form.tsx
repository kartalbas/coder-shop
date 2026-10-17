"use client";

import { useActionState, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction, type ReviewActionState } from "@/server/actions/reviews";

// Review form for verified buyers (issue #47). After a successful submit the review
// waits for moderation, so the form says so instead of pretending it is public.
export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const [state, formAction, pending] = useActionState<ReviewActionState | null, FormData>(
    submitReviewAction,
    null,
  );
  const [rating, setRating] = useState(0);

  if (state?.ok) {
    return (
      <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm" role="status">
        Vielen Dank! Ihre Bewertung ist eingereicht und wird in Kürze freigeschaltet.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      aria-label="Produkt bewerten"
      className="space-y-3 rounded-md border bg-muted/30 p-4"
    >
      <h3 className="font-semibold">Produkt bewerten</h3>
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Ihre Bewertung</legend>
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
                aria-label={`${star} von 5 Sternen`}
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
      <Input name="title" placeholder="Titel (optional)" maxLength={120} className="h-9" />
      <Textarea
        name="body"
        required
        minLength={10}
        maxLength={2000}
        placeholder={`Wie zufrieden sind Sie mit ${productName}?`}
        aria-label="Ihre Bewertung"
      />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending || rating === 0}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Bewertung absenden
      </Button>
    </form>
  );
}
