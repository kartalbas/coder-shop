export function isLowStock(stock: number, restockThreshold: number): boolean {
  return stock <= restockThreshold;
}

export type StockLevel = "in" | "low" | "out";

const LOW_STOCK_MIN_THRESHOLD = 5;

export function stockLevel(stock: number, restockThreshold: number): StockLevel {
  if (stock <= 0) return "out";
  if (stock <= Math.max(restockThreshold, LOW_STOCK_MIN_THRESHOLD)) return "low";
  return "in";
}

// Swiss German: the plural of „das Stück“ stays „Stück“ (issue #28), never „Stücke“.
export function stockLabel(level: StockLevel, stock: number): string {
  if (level === "out") return "Ausverkauft";
  if (level === "low") return `Nur noch ${stock} Stück`;
  return "Sofort lieferbar";
}
