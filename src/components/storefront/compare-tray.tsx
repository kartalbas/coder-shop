"use client";

import Link from "next/link";
import { Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interpolate, label } from "@/lib/i18n";
import { clearCompare, useCompare } from "@/stores/compare";
import { useLabels } from "./labels";

// Floating comparison tray (issue #48): shows how many smartphones are selected and
// links to the comparison page; appears only once something was picked. The link
// carries the slugs, so the comparison is also shareable.
export function CompareTray() {
  const labels = useLabels();
  const { slugs } = useCompare();
  if (slugs.length === 0) return null;
  const href = `/products/compare?slugs=${encodeURIComponent(slugs.join(","))}`;
  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur"
      data-testid="compare-tray"
    >
      <span className="text-sm font-medium">
        <Scale className="mr-1.5 inline size-4" aria-hidden />
        {interpolate(label(labels, "shop.compare.trayCount"), { count: slugs.length })}
      </span>
      <Button asChild size="sm" disabled={slugs.length < 2}>
        <Link href={href}>{label(labels, "shop.compare.action")}</Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label(labels, "shop.compare.clear")}
        data-testid="compare-clear"
        onClick={() => clearCompare()}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
