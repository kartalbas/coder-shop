// Payment methods of the shop (issue #40): the demo card and the invoice for registered
// customers. Names English, German labels are UI copy only (ARCHITECTURE language rule).
export const PAYMENT_METHODS = ["mock", "invoice"] as const;
export type PaymentMethodName = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethodName, string> = {
  mock: "Kreditkarte (Demo)",
  invoice: "Rechnung",
};
