export type OrderStatus =
  | "new"
  | "paid"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderStatusLogEntry {
  status: OrderStatus;
  at: Date;
  note?: string;
  by?: string;
}

export interface OrderLike {
  status: OrderStatus;
  statusLog: OrderStatusLogEntry[];
}

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["paid", "cancelled"],
  paid: ["picking", "cancelled"],
  picking: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const ORDER_STATUSES = Object.keys(TRANSITIONS) as OrderStatus[];

export const RESTOCK_STATUSES: readonly OrderStatus[] = ["new", "paid", "picking"];

// `packed → shipped` exists in the graph but only label creation may take it
// (REQUIREMENTS: "Creating a label moves the order to shipped") — a manual transition
// would produce a shipped order without tracking number, and label creation would then
// be impossible forever (issue #10).
export function isLabelOnlyTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === "packed" && to === "shipped";
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

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  opts: { viaLabel?: boolean } = {},
): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  return !isLabelOnlyTransition(from, to) || opts.viaLabel === true;
}

// Transitions a human may trigger from the admin UI — everything except the
// label-only `packed → shipped`, which is offered as "UPS-Etikett erstellen".
export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from].filter((to) => !isLabelOnlyTransition(from, to));
}

export function transitionsWithRestock(from: OrderStatus, to: OrderStatus): boolean {
  return to === "cancelled" && RESTOCK_STATUSES.includes(from);
}

export function transition<T extends OrderLike>(
  order: T,
  to: OrderStatus,
  opts: { note?: string; by?: string; at?: Date; viaLabel?: boolean } = {},
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
