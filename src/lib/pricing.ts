export const VAT_RATE_PERCENT = 8.1;

// The German-formatted VAT wording ("8,1 % MwSt.") — every UI note about VAT comes from
// here, so changing the rate above changes the copy too (issue #30).
export const VAT_LABEL = `${VAT_RATE_PERCENT.toFixed(1).replace(".", ",")} % MwSt.`;
export const VAT_INCLUSIVE_NOTE = `${VAT_LABEL} inbegriffen`;

export const SHIPPING_CENTS = {
  standard: 490,
  express: 1290,
} as const;

export const FREE_SHIPPING_FROM_CENTS = 10000;

export type ShippingMethodName = keyof typeof SHIPPING_CENTS;

export interface CartItem {
  unitPriceCents: number;
  qty: number;
}

export interface Totals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  vatCents: number;
}

export function vatFromGross(grossCents: number): number {
  return grossCents - Math.round((grossCents * 100) / (100 + VAT_RATE_PERCENT));
}

export function netFromGross(grossCents: number): number {
  return grossCents - vatFromGross(grossCents);
}

// The price a listing may advertise: the cheapest variant price that actually exists
// (issue #20). `from` is true when other variants cost more, so the UI says „ab CHF …".
export function buyablePriceCents(
  baseCents: number,
  priceDeltas: number[],
): { priceCents: number; from: boolean } {
  if (priceDeltas.length === 0) return { priceCents: baseCents, from: false };
  const min = Math.min(...priceDeltas);
  return { priceCents: baseCents + min, from: priceDeltas.some((d) => d !== min) };
}

export function subtotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);
}

export function shippingCents(subtotal: number, method: ShippingMethodName): number {
  if (subtotal >= FREE_SHIPPING_FROM_CENTS) return 0;
  return SHIPPING_CENTS[method];
}

// Free-shipping progress for the cart UI — the rule lives here, not in the components.
export function freeShippingProgress(subtotal: number): {
  remainingCents: number;
  percent: number;
  reached: boolean;
} {
  const remainingCents = Math.max(0, FREE_SHIPPING_FROM_CENTS - subtotal);
  return {
    remainingCents,
    percent: Math.min(100, (subtotal / FREE_SHIPPING_FROM_CENTS) * 100),
    reached: remainingCents === 0,
  };
}

export function computeTotals(items: CartItem[], method: ShippingMethodName): Totals {
  const subtotal = subtotalCents(items);
  const shipping = shippingCents(subtotal, method);
  const total = subtotal + shipping;
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    totalCents: total,
    vatCents: vatFromGross(total),
  };
}
