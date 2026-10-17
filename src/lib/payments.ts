// Payment methods of the shop (issue #40/#41): the demo card, the invoice for registered
// customers, and payment on pickup (cash or card at the counter). Names English, German
// labels are UI copy only (ARCHITECTURE language rule).
export const PAYMENT_METHODS = ["mock", "invoice", "pickup"] as const;
export type PaymentMethodName = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethodName, string> = {
  mock: "Kreditkarte (Demo)",
  invoice: "Rechnung",
  pickup: "Bei Abholung",
};

// How the money was taken at the counter (issue #41).
export const PICKUP_PAYMENT_TYPES = ["cash", "card"] as const;
export type PickupPaymentType = (typeof PICKUP_PAYMENT_TYPES)[number];

export const PICKUP_PAYMENT_TYPE_LABELS: Record<PickupPaymentType, string> = {
  cash: "Bar",
  card: "Karte",
};
