export function canFulfill(stock: number, qty: number): boolean {
  return Number.isInteger(qty) && qty > 0 && Number.isInteger(stock) && stock >= qty;
}

export function applyDelta(stock: number, delta: number): number {
  return stock + delta;
}

export function isLowStock(stock: number, restockThreshold: number): boolean {
  return stock <= restockThreshold;
}
