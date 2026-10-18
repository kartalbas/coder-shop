// Issue #62 (#55): "incoming stock" is derived, never stored twice — it is what the
// open purchase orders say. These pure helpers compute the expected arrival from the
// supplier lead time, aggregate the open quantity per SKU and phrase the German shop
// copy ("5 Stk. bestellt, Ankunft ca. in 3 Tagen") from one place.
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

// Coarse German arrival buckets — exact dates would promise more precision than a
// lead time has. ≤ 7 days count days, then weeks ("in 2 Wochen", "in 3 Wochen" …).
export function arrivalBucket(arrival: Date, now: Date): string {
  const days = Math.ceil((arrival.getTime() - now.getTime()) / DAY_MS);
  if (days <= 0) return "heute";
  if (days === 1) return "morgen";
  if (days <= 7) return `in ${days} Tagen`;
  const weeks = Math.ceil(days / 7);
  return `in ${weeks} Wochen`;
}

// The shop-facing sentence for a variant with incoming stock.
export function incomingLabel(qty: number, arrival: Date, now: Date): string {
  return `${qty} Stk. bestellt, Ankunft ca. ${arrivalBucket(arrival, now)}`;
}
