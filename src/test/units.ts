import { StockUnitModel } from "@/models/stock-unit";

// Issue #62 (#54): distinct serial numbers for goods-receipt fixtures — one per
// received piece, unique per SKU by construction.
export function serialList(sku: string, count: number, start = 1): string[] {
  return Array.from({ length: count }, (_, i) => `${sku}-S${String(start + i).padStart(3, "0")}`);
}

// Issue #62 (#54): fixture helper for serial-tracked types — every sellable piece
// needs its own `in_stock` unit, mirroring how the seed and goods receipt create
// them. Inserts `qty` distinct units for `sku`.
export async function seedUnitsForSku(sku: string, qty: number): Promise<void> {
  if (qty <= 0) return;
  const now = new Date();
  const start = await StockUnitModel.countDocuments({ sku });
  await StockUnitModel.insertMany(
    Array.from({ length: qty }, (_, index) => ({
      sku,
      serial: `SN-${sku}-${String(start + index + 1).padStart(4, "0")}`,
      status: "in_stock" as const,
      history: [{ status: "in_stock" as const, at: now, note: "Testbestand" }],
    })),
  );
}
