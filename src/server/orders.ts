import { openAmountCents } from "@/lib/invoices";
import type { PickupPaymentType } from "@/lib/payments";
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
  // Applied discount code (issue #45).
  discount?: { code: string; cents: number };
  shipping: {
    method: Order["shipping"]["method"];
    storePickup?: boolean;
    trackingNumber?: string;
    parcelWeightGrams?: number;
    pickup?: { code: string; readyAt?: string; pickedUpAt?: string; paymentType?: PickupPaymentType };
  };
  payment: {
    method: Order["payment"]["method"];
    kind: Order["payment"]["kind"];
    reference: string;
    paidAt?: string;
    invoice?: { dueAt: string; paidCents: number; openCents: number; qrReference: string };
  };
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
    ...(order.discount !== undefined && { discount: order.discount }),
    shipping: {
      method: order.shipping.method,
      storePickup: order.shipping.storePickup,
      ...(order.shipping.trackingNumber !== undefined && {
        trackingNumber: order.shipping.trackingNumber,
      }),
      ...(order.shipping.parcelWeightGrams !== undefined && {
        parcelWeightGrams: order.shipping.parcelWeightGrams,
      }),
      ...(order.shipping.pickup !== undefined && {
        pickup: {
          code: order.shipping.pickup.code,
          ...(order.shipping.pickup.readyAt !== undefined && {
            readyAt: order.shipping.pickup.readyAt.toISOString(),
          }),
          ...(order.shipping.pickup.pickedUpAt !== undefined && {
            pickedUpAt: order.shipping.pickup.pickedUpAt.toISOString(),
          }),
          ...(order.shipping.pickup.paymentType !== undefined && {
            paymentType: order.shipping.pickup.paymentType,
          }),
        },
      }),
    },
    payment: {
      method: order.payment.method,
      kind: order.payment.kind,
      reference: order.payment.reference,
      ...(order.payment.paidAt !== undefined && {
        paidAt: order.payment.paidAt.toISOString(),
      }),
      ...(order.payment.invoice !== undefined && {
        invoice: {
          dueAt: order.payment.invoice.dueAt.toISOString(),
          paidCents: order.payment.invoice.paidCents,
          openCents: openAmountCents(order.totals.totalCents, order.payment.invoice.paidCents),
          qrReference: order.payment.invoice.qrReference,
        },
      }),
    },
    createdAt: order.createdAt.toISOString(),
  };
}
