import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Star display (issue #47): `value` out of 5, halves not attempted — the average is
// shown as a number next to the stars anyway.
export function StarRating({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: "sm" | "lg";
  className?: string;
}) {
  const starClass = size === "lg" ? "size-5" : "size-4";
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toLocaleString("de-CH")} von 5 Sternen`}
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
