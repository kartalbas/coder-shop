import mongoose, { type ClientSession } from "mongoose";
import {
  ORDER_STATUSES,
  transition,
  transitionsWithRestock,
  type OrderStatus,
} from "@/lib/orders/state-machine";
import { OrderModel, type Order, type OrderDocument } from "@/models/order";
import { ProductModel } from "@/models/product";
import { connectDB } from "./db";

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
    "shipping.method": { $ne: "pickup" },
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
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return { ok: false, error: "Bestellung nicht gefunden." };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await OrderModel.findById(orderId).session(session).exec();
    if (!order) {
      await session.abortTransaction();
      return { ok: false, error: "Bestellung nicht gefunden." };
    }

    const from = order.status;
    // The order's payment and shipping method are part of the transition context
    // (issues #40/#41): invoice orders may go new → picking unpaid, pickup orders move
    // through ready → picked_up via the handover action, not these buttons.
    const updated = transition(
      {
        ...order.toObject(),
        paymentMethod: order.payment.method,
        shippingMethod: order.shipping.method,
      },
      to,
      { ...opts, paymentMethod: order.payment.method, shippingMethod: order.shipping.method },
    );

    const moved = await OrderModel.updateOne(
      { _id: order._id, status: from },
      { $set: { status: updated.status, statusLog: updated.statusLog } },
      { session },
    );
    if (moved.matchedCount === 0) {
      await session.abortTransaction();
      return {
        ok: false,
        error: "Die Bestellung wurde zwischenzeitlich geändert. Bitte erneut versuchen.",
      };
    }

    if (transitionsWithRestock(from, to)) {
      await restockLines(order, session);
    }

    await session.commitTransaction();
    return { ok: true, status: updated.status };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
