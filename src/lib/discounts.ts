// Discount codes (issue #45) — the pure rules; validity windows and limits are checked
// server-side against the database, the money math lives here so it is unit-testable.

export type DiscountKind = "percent" | "fixed";

export interface DiscountDef {
  kind: DiscountKind;
  // percent: 1–100; fixed: amountCents > 0. Exactly one applies per kind.
  percent?: number;
  amountCents?: number;
  minOrderCents: number;
}

// The discount in cents for a subtotal: 0 below the minimum order, never more than the
// subtotal itself (a code can never push the total negative).
export function discountForSubtotal(subtotalCents: number, def: DiscountDef): number {
  if (subtotalCents < def.minOrderCents) return 0;
  const raw =
    def.kind === "percent"
      ? Math.round((subtotalCents * (def.percent ?? 0)) / 100)
      : (def.amountCents ?? 0);
  return Math.max(0, Math.min(raw, subtotalCents));
}

export interface DiscountValidity {
  validFrom?: Date;
  validTo?: Date;
  active: boolean;
}

// Pure window check so the "stops working at its limits" rules are testable without a DB.
export function isDiscountInWindow(def: DiscountValidity, now: Date): boolean {
  if (!def.active) return false;
  if (def.validFrom && now < def.validFrom) return false;
  if (def.validTo && now > def.validTo) return false;
  return true;
}
