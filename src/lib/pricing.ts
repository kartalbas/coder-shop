export const VAT_RATE_PERCENT = 8.1;

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

export function subtotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);
}

export function shippingCents(subtotal: number, method: ShippingMethodName): number {
  if (subtotal >= FREE_SHIPPING_FROM_CENTS) return 0;
  return SHIPPING_CENTS[method];
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
