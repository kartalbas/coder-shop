import type { PaymentMethodName } from "@/lib/payments";

export type OrderStatus =
  | "new"
  | "paid"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
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
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["paid", "picking", "cancelled"],
  paid: ["picking", "cancelled"],
  picking: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const ORDER_STATUSES = Object.keys(TRANSITIONS) as OrderStatus[];

const RESTOCK_STATUSES: readonly OrderStatus[] = ["new", "paid", "picking"];

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
  paymentMethod?: PaymentMethodName;
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  opts: TransitionContext = {},
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  if (isLabelOnlyTransition(from, to)) return opts.viaLabel === true;
  if (isUnpaidProcessingTransition(from, to)) return opts.paymentMethod === "invoice";
  if (from === "new" && to === "paid" && opts.paymentMethod === "invoice") {
    return opts.viaInvoicePayment === true;
  }
  return true;
}

// Transitions a human may trigger from the admin UI — not the label-only
// `packed → shipped` (offered as "UPS-Etikett erstellen"), not the unpaid `new → picking`
// of invoice orders (offered by the packing workflow), and not the `new → paid` of an
// invoice order (recorded on the invoice page, where the amount is entered).
export function allowedTransitions(from: OrderStatus, ctx: { paymentMethod?: PaymentMethodName } = {}): readonly OrderStatus[] {
  return TRANSITIONS[from].filter((to) => {
    if (isLabelOnlyTransition(from, to)) return false;
    if (isUnpaidProcessingTransition(from, to)) return ctx.paymentMethod === "invoice";
    if (isInvoicePaymentTransition(from, to) && ctx.paymentMethod === "invoice") return false;
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
