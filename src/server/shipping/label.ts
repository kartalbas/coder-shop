import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { parcelWeightGrams } from "@/lib/shipping/weight";
import type { LabelRequest, ShippingProvider } from "@/lib/shipping/types";
import { transition } from "@/lib/orders/state-machine";
import { OrderModel } from "@/models/order";
import { connectDB } from "../db";
import { getShippingProvider } from "./provider";

export const LABELS_DIR = path.join("data", "labels");

export type CreateLabelResult =
  | { ok: true; trackingNumber: string; labelPath: string }
  | { ok: false; error: string };

export async function createLabelCore(
  orderId: string,
  provider: ShippingProvider = getShippingProvider(),
): Promise<CreateLabelResult> {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return { ok: false, error: "Bestellung nicht gefunden." };

  const order = await OrderModel.findById(orderId).lean().exec();
  if (!order) return { ok: false, error: "Bestellung nicht gefunden." };

  if (order.status === "shipped" && order.shipping.trackingNumber && order.shipping.labelPath) {
    return {
      ok: true,
      trackingNumber: order.shipping.trackingNumber,
      labelPath: order.shipping.labelPath,
    };
  }
  if (order.status !== "packed") {
    return { ok: false, error: "Ein Etikett kann nur für gepackte Bestellungen erstellt werden." };
  }

  const weight = parcelWeightGrams(order.lines);
  const labelRequest: LabelRequest = {
    orderNumber: order.orderNumber,
    recipient: {
      name: order.customer.name,
      street: order.customer.street,
      postalCode: order.customer.postalCode,
      city: order.customer.city,
      country: order.customer.country,
      phone: order.customer.phone,
    },
    parcelWeightGrams: weight,
    service: order.shipping.method,
  };

  const label = await provider.createLabel(labelRequest);
  if (!label.ok) return { ok: false, error: label.error };

  const labelPath = path.join(LABELS_DIR, `${order.orderNumber}.pdf`);
  await fs.mkdir(path.resolve(LABELS_DIR), { recursive: true });
  await fs.writeFile(path.resolve(labelPath), label.labelPdf);

  const updated = transition({ status: order.status, statusLog: order.statusLog }, "shipped", {
    note: `UPS-Sendung ${label.trackingNumber}`,
    by: provider.name,
  });

  const moved = await OrderModel.findOneAndUpdate(
    { _id: order._id, status: "packed" },
    {
      $set: {
        status: updated.status,
        statusLog: updated.statusLog,
        shipping: {
          method: order.shipping.method,
          carrier: "ups" as const,
          trackingNumber: label.trackingNumber,
          labelPath,
          parcelWeightGrams: weight,
        },
      },
    },
    { new: true },
  )
    .select("shipping.trackingNumber shipping.labelPath")
    .lean()
    .exec();

  if (!moved) {
    const concurrent = await OrderModel.findById(order._id).lean().exec();
    if (concurrent?.shipping.trackingNumber && concurrent.shipping.labelPath) {
      return {
        ok: true,
        trackingNumber: concurrent.shipping.trackingNumber,
        labelPath: concurrent.shipping.labelPath,
      };
    }
    return { ok: false, error: "Etikett konnte nicht gespeichert werden. Bitte erneut versuchen." };
  }

  return { ok: true, trackingNumber: label.trackingNumber, labelPath };
}
