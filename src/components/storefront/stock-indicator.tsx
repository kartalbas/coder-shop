import { cn } from "@/lib/utils";
import { stockLevel, type StockLevel } from "@/lib/stock";

const STYLES: Record<StockLevel, { dot: string; text: string; label: (stock: number) => string }> = {
  in: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: () => "Sofort lieferbar" },
  low: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    label: (stock) => `Nur noch ${stock} ${stock === 1 ? "Stück" : "Stücke"}`,
  },
  out: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400", label: () => "Ausverkauft" },
};

export function StockIndicator({ stock, restockThreshold }: { stock: number; restockThreshold: number }) {
  const level = stockLevel(stock, restockThreshold);
  const style = STYLES[level];
  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium", style.text)}>
      <span aria-hidden className={cn("size-2 rounded-full", style.dot)} />
      {style.label(stock)}
    </p>
  );
}
