"use client";

import { useLabels } from "@/components/storefront/labels";
import { interpolate, label } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { stockLevel, type StockLevel } from "@/lib/stock";

// Issue #26: the 600 tones failed axe contrast on the light background — 700 reaches 4.5:1.
const STYLES: Record<StockLevel, { dot: string; text: string }> = {
  in: { dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  low: { dot: "bg-amber-600", text: "text-amber-700 dark:text-amber-400" },
  out: { dot: "bg-red-600", text: "text-red-700 dark:text-red-400" },
};

// Issue #58 step 3: the stock sentence is a translation-table text per level.
export function StockIndicator({
  stock,
  restockThreshold,
}: {
  stock: number;
  restockThreshold: number;
}) {
  const labels = useLabels();
  const level = stockLevel(stock, restockThreshold);
  const style = STYLES[level];
  const text =
    level === "out"
      ? label(labels, "shop.state.soldOut")
      : level === "low"
        ? interpolate(label(labels, "shop.stock.low"), { stock })
        : label(labels, "shop.stock.in");
  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium", style.text)}>
      <span aria-hidden className={cn("size-2 rounded-full", style.dot)} />
      {text}
    </p>
  );
}
