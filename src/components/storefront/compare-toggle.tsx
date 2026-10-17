"use client";

import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleCompare, useCompare } from "@/stores/compare";

// „Vergleichen" toggle for smartphone cards and the product page (issue #48).
export function CompareToggle({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const { slugs } = useCompare();
  const active = slugs.includes(slug);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${name} aus dem Vergleich entfernen` : `${name} vergleichen`}
      title={active ? "Aus dem Vergleich entfernen" : "Vergleichen"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleCompare(slug);
      }}
      className={cn(
        "rounded-full border bg-background/90 p-2 shadow-sm backdrop-blur transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring",
        active ? "border-sky-400 text-sky-700 dark:text-sky-300" : "text-muted-foreground",
        className,
      )}
    >
      <Scale className="size-4" aria-hidden />
    </button>
  );
}
