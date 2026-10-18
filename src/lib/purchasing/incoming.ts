// Issue #62 (#55): "incoming stock" is derived, never stored twice — it is what the
// open purchase orders say. These pure helpers compute the expected arrival from the
// supplier lead time and aggregate the open quantity per SKU; the shop copy
// ("5 Stk. bestellt, Ankunft ca. in 3 Tagen") comes from the translation table
// (#58 step 3), so the phrasing follows the request language.
import { interpolate, label } from "@/lib/i18n";
export const DAY_MS = 24 * 60 * 60 * 1000;

// When a PO ordered at `orderedAt` from a supplier with `leadTimeDays` is expected.
export function expectedArrival(orderedAt: Date, leadTimeDays: number): Date {
  return new Date(orderedAt.getTime() + Math.max(0, leadTimeDays) * DAY_MS);
}

export interface IncomingLine {
  sku: string;
  qty: number;
  received: number;
  arrival?: Date | null;
}

export interface IncomingInfo {
  /** Ordered and not yet received. */
  qty: number;
  /** Earliest expected arrival over the contributing purchase orders. */
  arrival: Date;
}

// Per-SKU open quantity over PO lines of POs that are still on order, with the
// earliest expected arrival; SKUs without an open quantity do not appear.
export function incomingForLines(lines: readonly IncomingLine[]): Map<string, IncomingInfo> {
  const bySku = new Map<string, IncomingInfo>();
  for (const line of lines) {
    const open = line.qty - line.received;
    if (open <= 0) continue;
    const arrival = line.arrival ?? null;
    const existing = bySku.get(line.sku);
    if (!existing) {
      bySku.set(line.sku, { qty: open, arrival: arrival ?? new Date() });
      continue;
    }
    existing.qty += open;
    if (arrival && arrival < existing.arrival) existing.arrival = arrival;
  }
  return bySku;
}

// Coarse arrival buckets — exact dates would promise more precision than a lead time
// has. ≤ 7 days count days, then weeks ("in 2 Wochen", "in 3 Wochen" …). The bucket
// texts are translation-table keys, so every language phrases them itself.
export function arrivalBucket(
  labels: Readonly<Record<string, string>>,
  arrival: Date,
  now: Date,
): string {
  const days = Math.ceil((arrival.getTime() - now.getTime()) / DAY_MS);
  if (days <= 0) return label(labels, "shop.product.arrival.today");
  if (days === 1) return label(labels, "shop.product.arrival.tomorrow");
  if (days <= 7) return interpolate(label(labels, "shop.product.arrival.days"), { days });
  return interpolate(label(labels, "shop.product.arrival.weeks"), {
    weeks: Math.ceil(days / 7),
  });
}

// The shop-facing sentence for a variant with incoming stock.
export function incomingLabel(
  labels: Readonly<Record<string, string>>,
  qty: number,
  arrival: Date,
  now: Date,
): string {
  return interpolate(label(labels, "shop.product.incoming"), {
    qty,
    bucket: arrivalBucket(labels, arrival, now),
  });
}
