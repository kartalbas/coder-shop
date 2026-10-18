import mongoose, { type ClientSession } from "mongoose";
import { label } from "@/lib/i18n";
import {
  flowFlagsFor,
  ORDER_STATUSES,
  transition,
  transitionsWithRestock,
  type OrderStatus,
} from "@/lib/orders/state-machine";
import { unitMoveForOrderStatus } from "@/lib/stock-units";
import { OrderModel, type Order, type OrderDocument, type OrderLine } from "@/models/order";
import { ProductModel } from "@/models/product";
import { connectDB } from "./db";
import { getRequestLabels } from "./i18n";
import { notifyRestockedCore } from "./restock-alerts";
import { advanceUnitsForOrder, releaseUnitsForOrder } from "./stock-units";

export type OrderFilter = OrderStatus | "all";

export const ORDER_LIST_LIMIT = 200;

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  customerName: string;
  totalCents: number;
  itemCount: number;
}

export interface OrderStatusCounts {
  all: number;
  byStatus: Record<OrderStatus, number>;
}

export async function listOrders(filter: OrderFilter): Promise<OrderListItem[]> {
  await connectDB();
  const query = filter === "all" ? {} : { status: filter };
  const orders = await OrderModel.find(query)
    .sort({ createdAt: -1 })
    .limit(ORDER_LIST_LIMIT)
    .lean<Order[]>()
    .exec();
  return orders.map((order) => ({
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    customerName: order.customer.name,
    totalCents: order.totals.totalCents,
    itemCount: order.lines.reduce((sum, line) => sum + line.qty, 0),
  }));
}

export async function countOrdersByStatus(): Promise<OrderStatusCounts> {
  await connectDB();
  const rows = await OrderModel.aggregate<{ _id: OrderStatus; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  let all = 0;
  for (const row of rows) {
    byStatus[row._id] = row.count;
    all += row.count;
  }
  return { all, byStatus };
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return null;
  return OrderModel.findById(orderId).lean<Order>().exec();
}

export async function listPackingQueue(): Promise<OrderListItem[]> {
  await connectDB();
  // Pickup orders live in the pickup queue (issue #41), not in the parcel packing list.
  const orders = await OrderModel.find({
    status: { $in: ["picking", "packed"] },
    "shipping.storePickup": { $ne: true },
  })
    .sort({ status: 1, createdAt: 1 })
    .lean<Order[]>()
    .exec();
  return orders.map((order) => ({
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    customerName: order.customer.name,
    totalCents: order.totals.totalCents,
    itemCount: order.lines.reduce((sum, line) => sum + line.qty, 0),
  }));
}

async function restockLines(order: OrderDocument, session: ClientSession): Promise<void> {
  for (const line of order.lines) {
    await ProductModel.findOneAndUpdate(
      { _id: line.productId, "variants.sku": line.sku },
      { $inc: { "variants.$[v].stock": line.qty } },
      { arrayFilters: [{ "v.sku": line.sku }], session },
    );
  }
}

export type TransitionOrderResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; error: string };

export async function transitionOrderCore(
  orderId: string,
  to: OrderStatus,
  opts: { note?: string; by?: string } = {},
): Promise<TransitionOrderResult> {
  // Issue #58 step 2: refusals answer in the request language (outside a request the
  // first active language does — the German base every script and test relies on).
  const labels = await getRequestLabels();
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, error: label(labels, "admin.error.orderNotFound") };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await OrderModel.findById(orderId).session(session).exec();
    if (!order) {
      await session.abortTransaction();
      return { ok: false, error: label(labels, "admin.error.orderNotFound") };
    }

    const from = order.status;
    // The order's stored flow flags are part of the transition context (issues
    // #40/#41/#64): invoice-kind payments may go new → picking unpaid, store-pickup
    // orders move through ready → picked_up via the handover action, not these buttons.
    const flags = flowFlagsFor({
      paymentKind: order.payment.kind,
      storePickup: order.shipping.storePickup,
    });
    const updated = transition(order.toObject(), to, { ...opts, ...flags });

    const moved = await OrderModel.updateOne(
      { _id: order._id, status: from },
      { $set: { status: updated.status, statusLog: updated.statusLog } },
      { session },
    );
    if (moved.matchedCount === 0) {
      await session.abortTransaction();
      return { ok: false, error: label(labels, "admin.orders.error.conflict") };
    }

    const restock = transitionsWithRestock(from, to);
    if (restock) {
      await restockLines(order, session);
    }

    // Issue #62 (#54): serial units move with the order — packed/shipped travel,
    // delivered sells them, a restocking cancel puts them back on the shelf.
    const unitStep = unitMoveForOrderStatus(to);
    if (unitStep.release && restock) {
      await releaseUnitsForOrder(order.orderNumber, session);
    } else if (unitStep.move) {
      await advanceUnitsForOrder(order.orderNumber, unitStep.move, `Bestellung ${to}`, session);
    }

    await session.commitTransaction();
    // Issue #46: a cancel that puts stock back can satisfy waiting customers too —
    // the mail never fails the transition.
    if (restock) {
      try {
        await notifyRestockedCore(order.lines.map((line: OrderLine) => line.sku));
      } catch (error) {
        console.error("Wieder-verfügbar-Benachrichtigung fehlgeschlagen", error);
      }
    }
    return { ok: true, status: updated.status };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
