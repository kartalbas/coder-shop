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

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Illegal order transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function transitionsWithRestock(from: OrderStatus, to: OrderStatus): boolean {
  return to === "cancelled" && RESTOCK_STATUSES.includes(from);
}

export function transition<T extends OrderLike>(
  order: T,
  to: OrderStatus,
  opts: { note?: string; by?: string; at?: Date } = {},
): T {
  if (!canTransition(order.status, to)) {
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
