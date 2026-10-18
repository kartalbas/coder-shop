// Issue #62 (#54): serial-number stock. Types whose catalog config says
// `stockTracking: "serial"` are stocked as individual units; each unit walks the
// chain below and every move is logged. Quantity-tracked types never touch this.
export type StockUnitStatus = "in_stock" | "reserved" | "packed" | "shipped" | "sold";

export const STOCK_UNIT_STATUSES: readonly StockUnitStatus[] = [
  "in_stock",
  "reserved",
  "packed",
  "shipped",
  "sold",
];

// Where a unit may go next. `in_stock` is reachable from every unsold status —
// a cancel releases the unit back to the shelf.
const NEXT: Record<StockUnitStatus, readonly StockUnitStatus[]> = {
  in_stock: ["reserved"],
  reserved: ["packed", "sold", "in_stock"],
  packed: ["shipped", "in_stock"],
  shipped: ["sold", "in_stock"],
  sold: [],
};

export function canMoveUnit(from: StockUnitStatus, to: StockUnitStatus): boolean {
  return NEXT[from].includes(to);
}

// The statuses a unit must be in to move to `to` — derived from the same chain.
export function unitSourcesFor(to: StockUnitStatus): StockUnitStatus[] {
  return STOCK_UNIT_STATUSES.filter((status) => canMoveUnit(status, to));
}

// The unit move that belongs to an order status change; no move when the status does
// not concern serial units. Cancelling restocks (`release`) only happens when the
// order transition restocks — the caller decides that with the order state machine.
export function unitMoveForOrderStatus(to: string): {
  move: StockUnitStatus | null;
  release: boolean;
} {
  switch (to) {
    case "packed":
      return { move: "packed", release: false };
    case "shipped":
      return { move: "shipped", release: false };
    case "delivered":
    case "picked_up":
      return { move: "sold", release: false };
    case "cancelled":
      return { move: null, release: true };
    default:
      return { move: null, release: false };
  }
}

// Issue #58 step 4: the status copy lives in the translation table
// (`admin.stockUnits.status.<status>`), rendered in the request language.

// Serial input validation (goods receipt): trimmed, printable, bounded — the
// uniqueness per SKU is a database concern, not a format one.
export function normalizeSerial(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 4 || trimmed.length > 64) return null;
  if (!/^[\w\-/.]+$/.test(trimmed)) return null;
  return trimmed;
}
