import type { ShippingMethodName } from "@/lib/pricing";
import type { PaymentMethodName } from "@/lib/payments";

export type OrderStatus =
  | "new"
  | "paid"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "ready"
  | "picked_up"
  | "cancelled";

interface OrderStatusLogEntry {
  status: OrderStatus;
  at: Date;
  note?: string;
  by?: string;
}

export interface OrderLike {
  status: OrderStatus;
  statusLog: OrderStatusLogEntry[];
  paymentMethod?: PaymentMethodName;
  shippingMethod?: ShippingMethodName;
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["paid", "picking", "ready", "cancelled"],
  paid: ["picking", "cancelled"],
  picking: ["packed", "ready", "cancelled"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  ready: ["picked_up", "cancelled"],
  picked_up: [],
  cancelled: [],
};

export const ORDER_STATUSES = Object.keys(TRANSITIONS) as OrderStatus[];

// Cancelling any of these restocks — the goods never left the shop. `ready` included
// (issue #41): a pickup order that was never collected goes back on the shelf.
const RESTOCK_STATUSES: readonly OrderStatus[] = ["new", "paid", "picking", "ready"];

// The non-cancelled path through the graph — the single source for anything that renders
// or reasons about "how far is this order" (issue #31).
export const HAPPY_PATH: readonly OrderStatus[] = [
  "new",
  "paid",
  "picking",
  "packed",
  "shipped",
  "delivered",
];

// The pickup path (issue #41) — replaces packed/shipped/delivered for store collection.
// `picking` is deliberately not a milestone: an order may be marked ready directly from
// `new`, and the customer chain must never show a step that can be skipped.
export const PICKUP_PATH: readonly OrderStatus[] = ["new", "ready", "picked_up"];

// `packed → shipped` exists in the graph but only label creation may take it
// (REQUIREMENTS: "Creating a label moves the order to shipped") — a manual transition
// would produce a shipped order without tracking number, and label creation would then
// be impossible forever (issue #10).
export function isLabelOnlyTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "packed" && to === "shipped";
}

// Invoice orders are processed before the money arrives (issue #40): `new → picking`
// is legal for them, and only for them — a card order that skips `paid` would be
// shipped without payment.
function isUnpaidProcessingTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "new" && to === "picking";
}

// For invoice orders `new → paid` is the money path: it belongs to the invoice payment
// (which records the amount), not to the admin status buttons.
function isInvoicePaymentTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "new" && to === "paid";
}

// Pickup statuses belong to pickup orders only (issue #41) — a delivered parcel order
// cannot suddenly be "ready for collection", and a pickup order never enters the
// packed/shipped/delivered parcel chain.
function isPickupStatus(status: OrderStatus): boolean {
  return status === "ready" || status === "picked_up";
}

// `ready → picked_up` is the handover at the counter: it records the payment, so it
// belongs to the pickup queue's handover action, not to the status buttons (like the
// label-only `packed → shipped`, issue #10).
function isPickupHandoverTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "ready" && to === "picked_up";
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Illegal order transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export interface TransitionContext {
  viaLabel?: boolean;
  viaInvoicePayment?: boolean;
  viaPickupHandover?: boolean;
  paymentMethod?: PaymentMethodName;
  shippingMethod?: ShippingMethodName;
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  opts: TransitionContext = {},
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  // A pickup order is collected, never shipped (issue #41) — the parcel chain is
  // closed for it entirely, ahead of every exception below.
  if (
    opts.shippingMethod === "pickup" &&
    (to === "packed" || to === "shipped" || to === "delivered")
  ) {
    return false;
  }
  if (isLabelOnlyTransition(from, to)) return opts.viaLabel === true;
  if (isPickupHandoverTransition(from, to)) {
    return opts.shippingMethod === "pickup" && opts.viaPickupHandover === true;
  }
  if (isPickupStatus(to) || isPickupStatus(from)) return opts.shippingMethod === "pickup";
  if (isUnpaidProcessingTransition(from, to)) {
    return opts.paymentMethod === "invoice" || opts.paymentMethod === "pickup";
  }
  // A pickup order is never "paid" as a workflow status — the money is recorded at the
  // handover (`ready → picked_up`), so `new → paid` is closed for it entirely.
  if (from === "new" && to === "paid" && opts.paymentMethod === "pickup") return false;
  if (from === "new" && to === "paid" && opts.paymentMethod === "invoice") {
    return opts.viaInvoicePayment === true;
  }
  return true;
}

// Transitions a human may trigger from the admin UI — not the label-only
// `packed → shipped` (offered as "UPS-Etikett erstellen"), not the handover-only
// `ready → picked_up` (the pickup queue records the payment there, #41), not the unpaid
// `new → picking` of invoice/pickup orders (offered by the packing/pickup workflow), and
// not the `new → paid` of an invoice/pickup order (recorded where the money is).
export function allowedTransitions(
  from: OrderStatus,
  ctx: { paymentMethod?: PaymentMethodName; shippingMethod?: ShippingMethodName } = {},
): readonly OrderStatus[] {
  return TRANSITIONS[from].filter((to) => {
    if (isLabelOnlyTransition(from, to)) return false;
    if (isPickupHandoverTransition(from, to)) return false;
    if (isPickupStatus(to) || isPickupStatus(from)) return ctx.shippingMethod === "pickup";
    if (ctx.shippingMethod === "pickup" && (to === "packed" || to === "shipped" || to === "delivered")) {
      return false;
    }
    if (isUnpaidProcessingTransition(from, to)) {
      return ctx.paymentMethod === "invoice" || ctx.paymentMethod === "pickup";
    }
    if (isInvoicePaymentTransition(from, to) && (ctx.paymentMethod === "invoice" || ctx.paymentMethod === "pickup")) {
      return false; // invoice: recorded with the amount; pickup: recorded at handover
    }
    return true;
  });
}

export function transitionsWithRestock(from: OrderStatus, to: OrderStatus): boolean {
  return to === "cancelled" && RESTOCK_STATUSES.includes(from);
}

export function transition<T extends OrderLike>(
  order: T,
  to: OrderStatus,
  opts: TransitionContext & { note?: string; by?: string; at?: Date } = {},
): T {
  if (!canTransition(order.status, to, opts)) {
    throw new IllegalTransitionError(order.status, to);
  }
  const entry: OrderStatusLogEntry = {
    status: to,
    at: opts.at ?? new Date(),
    ...(opts.note !== undefined && { note: opts.note }),
    ...(opts.by !== undefined && { by: opts.by }),
  };
  return { ...order, status: to, statusLog: [...order.statusLog, entry] };
}
