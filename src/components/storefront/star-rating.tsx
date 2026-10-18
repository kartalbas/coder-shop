"use client";

import { Star } from "lucide-react";
import { useLabels } from "@/components/labels";
import { useFormatters } from "@/components/locale-formatters";
import { interpolate, label } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Star display (issue #47): `value` out of 5, halves not attempted — the average is
// shown as a number next to the stars anyway. The aria text is the review form's star
// row (#58 step 3) — the same sentence, so the same row, never a copy.
export function StarRating({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { number } = useFormatters();
  const labels = useLabels();
  const starClass = size === "lg" ? "size-5" : "size-4";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={interpolate(label(labels, "shop.reviews.starAria"), { star: number(value) })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            starClass,
            star <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}
