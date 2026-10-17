// Issue #64 (docs/REQUIREMENTS.md "AGNOSTIC AND DYNAMIC"): the shop's commerce rules —
// VAT rate, shipping methods and prices, payment methods — are DATA, not code. The
// persisted source is the `shop_settings` collection; `DEFAULT_SHOP_SETTINGS` below is
// only its seed content. Generic code (pricing, checkout, state machine context, admin)
// reads the configuration — changing a price or offering a new payment method needs no
// code change.
export type PaymentMethodKind = "immediate" | "invoice" | "on_pickup";

export interface ShippingMethodConfig {
  /** Param/order key, e.g. "standard". */
  key: string;
  /** UI label, e.g. "Standard". */
  label: string;
  /** Price in cents; the free-shipping threshold still applies unless storePickup. */
  priceCents: number;
  /** Order in the checkout list. */
  position: number;
  active: boolean;
  /** Collected in the store: free, no parcel chain, handover code (issue #41). */
  storePickup: boolean;
  /** Delivery-time hint under the label in the checkout list (UI copy). */
  hint: string;
}

export interface PaymentMethodConfig {
  /** Param/order key, e.g. "mock". */
  key: string;
  /** UI label, e.g. "Rechnung". */
  label: string;
  position: number;
  active: boolean;
  /**
   * How the money flows: "immediate" pays at checkout, "invoice" is processed unpaid
   * against the account's credit (issue #40), "on_pickup" is paid at the counter
   * together with a storePickup shipping method (issue #41).
   */
  kind: PaymentMethodKind;
}

export interface ShopSettings {
  vatRatePercent: number;
  freeShippingFromCents: number;
  shippingMethods: ShippingMethodConfig[];
  paymentMethods: PaymentMethodConfig[];
}

// Seed content of `shop_settings` — the rules the demo shop starts with.
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  vatRatePercent: 8.1,
  freeShippingFromCents: 10000,
  shippingMethods: [
    { key: "standard", label: "Standard", priceCents: 490, position: 1, active: true, storePickup: false, hint: "2–4 Werktage" },
    { key: "express", label: "Express", priceCents: 1290, position: 2, active: true, storePickup: false, hint: "nächster Werktag" },
    { key: "pickup", label: "Abholung im Laden", priceCents: 0, position: 3, active: true, storePickup: true, hint: "kostenlos abholen" },
  ],
  paymentMethods: [
    { key: "mock", label: "Kreditkarte (Demo)", position: 1, active: true, kind: "immediate" },
    { key: "invoice", label: "Rechnung", position: 2, active: true, kind: "invoice" },
    { key: "pickup", label: "Bei Abholung", position: 3, active: true, kind: "on_pickup" },
  ],
};

export function activeShippingMethods(settings: ShopSettings): ShippingMethodConfig[] {
  return settings.shippingMethods
    .filter((method) => method.active)
    .sort((a, b) => a.position - b.position);
}

export function activePaymentMethods(settings: ShopSettings): PaymentMethodConfig[] {
  return settings.paymentMethods
    .filter((method) => method.active)
    .sort((a, b) => a.position - b.position);
}

// Look-ups include inactive rows: orders and invoices keep referencing the key they were
// booked with even after a method is retired.
export function shippingMethodByKey(
  settings: ShopSettings,
  key: string,
): ShippingMethodConfig | undefined {
  return settings.shippingMethods.find((method) => method.key === key);
}

export function paymentMethodByKey(
  settings: ShopSettings,
  key: string,
): PaymentMethodConfig | undefined {
  return settings.paymentMethods.find((method) => method.key === key);
}

// The payment methods that may pair with a shipping method: "on_pickup" exists only
// with store pickup, "invoice" only with a delivered parcel (its credit flow assumes a
// shipping address and the parcel workflow — issue #41).
export function paymentMethodsForShipping(
  settings: ShopSettings,
  shipping: ShippingMethodConfig,
): PaymentMethodConfig[] {
  return activePaymentMethods(settings).filter((method) => {
    if (method.kind === "on_pickup") return shipping.storePickup;
    if (method.kind === "invoice") return !shipping.storePickup;
    return true;
  });
}

// The German-formatted VAT wording ("8,1 % MwSt.") — every UI note about VAT comes from
// here, so changing the configured rate changes the copy too (issues #30/#64).
export function vatLabel(vatRatePercent: number): string {
  return `${vatRatePercent.toFixed(1).replace(".", ",")} % MwSt.`;
}

export function vatInclusiveNote(vatRatePercent: number): string {
  return `${vatLabel(vatRatePercent)} inbegriffen`;
}
