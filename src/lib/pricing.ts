import type { ShopSettings } from "@/lib/shop-settings";
import { shippingMethodByKey } from "@/lib/shop-settings";

// Issue #64: every rule these functions apply (VAT rate, shipping prices, free-shipping
// threshold) comes from the shop settings — data read by generic code, never a constant.

export interface CartItem {
  unitPriceCents: number;
  qty: number;
}

export interface Totals {
  subtotalCents: number;
  shippingCents: number;
  // Discount code reduction (issue #45); 0 when no code was applied.
  discountCents: number;
  totalCents: number;
  vatCents: number;
}

export function vatFromGross(grossCents: number, vatRatePercent: number): number {
  return grossCents - Math.round((grossCents * 100) / (100 + vatRatePercent));
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

// Unknown method keys cost nothing here — the checkout validates the key against the
// active configuration before totals are ever computed.
export function shippingCents(
  subtotal: number,
  methodKey: string,
  settings: ShopSettings,
): number {
  const method = shippingMethodByKey(settings, methodKey);
  if (!method || method.storePickup) return 0;
  if (subtotal >= settings.freeShippingFromCents) return 0;
  return method.priceCents;
}

// Free-shipping progress for the cart UI — the rule lives here, not in the components.
export function freeShippingProgress(subtotal: number, settings: ShopSettings): {
  remainingCents: number;
  percent: number;
  reached: boolean;
} {
  const threshold = settings.freeShippingFromCents;
  const remainingCents = Math.max(0, threshold - subtotal);
  return {
    remainingCents,
    percent: threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100,
    reached: remainingCents === 0,
  };
}

// The discount (issue #45) reduces the taxable gross — VAT is computed over the
// discounted total, exactly like every other price in this gross-price shop.
export function computeTotals(
  items: CartItem[],
  methodKey: string,
  settings: ShopSettings,
  discountCents = 0,
): Totals {
  const subtotal = subtotalCents(items);
  const discount = Math.max(0, Math.min(discountCents, subtotal));
  const shipping = shippingCents(subtotal, methodKey, settings);
  const total = subtotal - discount + shipping;
  return {
    subtotalCents: subtotal,
    shippingCents: shipping,
    discountCents: discount,
    totalCents: total,
    vatCents: vatFromGross(total, settings.vatRatePercent),
  };
}
