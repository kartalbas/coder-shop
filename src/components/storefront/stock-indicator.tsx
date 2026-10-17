import { cn } from "@/lib/utils";
import { stockLabel, stockLevel, type StockLevel } from "@/lib/stock";

// Issue #26: the 600 tones failed axe contrast on the light background — 700 reaches 4.5:1.
const STYLES: Record<StockLevel, { dot: string; text: string }> = {
  in: { dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  low: { dot: "bg-amber-600", text: "text-amber-700 dark:text-amber-400" },
  out: { dot: "bg-red-600", text: "text-red-700 dark:text-red-400" },
};

export function StockIndicator({ stock, restockThreshold }: { stock: number; restockThreshold: number }) {
  const level = stockLevel(stock, restockThreshold);
  const style = STYLES[level];
  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium", style.text)}>
      <span aria-hidden className={cn("size-2 rounded-full", style.dot)} />
      {stockLabel(level, stock)}
    </p>
  );
}
