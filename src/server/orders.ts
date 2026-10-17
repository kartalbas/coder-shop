import { OrderModel, type Order } from "@/models/order";
import { connectDB } from "./db";

export interface OrderDto {
  orderNumber: string;
  status: Order["status"];
  statusLog: { status: Order["status"]; at: string; note?: string; by?: string }[];
  customer: Order["customer"];
  lines: {
    sku: string;
    name: string;
    variantLabel: string;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
  }[];
  totals: Order["totals"];
  shipping: {
    method: Order["shipping"]["method"];
    trackingNumber?: string;
    parcelWeightGrams?: number;
  };
  payment: { reference: string; paidAt?: string };
  createdAt: string;
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderDto | null> {
  await connectDB();
  const order = await OrderModel.findOne({ orderNumber }).lean<Order>().exec();
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    statusLog: order.statusLog.map((entry) => ({
      status: entry.status,
      at: entry.at.toISOString(),
      ...(entry.note !== undefined && { note: entry.note }),
      ...(entry.by !== undefined && { by: entry.by }),
    })),
    customer: order.customer,
    lines: order.lines.map((line) => ({
      sku: line.sku,
      name: line.name,
      variantLabel: line.variantLabel,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.totalCents,
    })),
    totals: order.totals,
    shipping: {
      method: order.shipping.method,
      ...(order.shipping.trackingNumber !== undefined && {
        trackingNumber: order.shipping.trackingNumber,
      }),
      ...(order.shipping.parcelWeightGrams !== undefined && {
        parcelWeightGrams: order.shipping.parcelWeightGrams,
      }),
    },
    payment: {
      reference: order.payment.reference,
      ...(order.payment.paidAt !== undefined && {
        paidAt: order.payment.paidAt.toISOString(),
      }),
    },
    createdAt: order.createdAt.toISOString(),
  };
}
