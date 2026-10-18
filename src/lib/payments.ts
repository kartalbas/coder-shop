// Issue #64: the shop's payment methods are configuration rows in `shop_settings`
// (src/lib/shop-settings.ts) — this file only keeps the counter handover detail.

// How the money was taken at the counter (issue #41); the labels are
// `admin.pickup.paymentType.<type>` rows in the translation table (#58 step 2).
export const PICKUP_PAYMENT_TYPES = ["cash", "card"] as const;
export type PickupPaymentType = (typeof PICKUP_PAYMENT_TYPES)[number];
