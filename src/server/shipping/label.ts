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

export type CreateLabelFailureReason = "not_found" | "not_packed" | "provider_error" | "conflict";

export type CreateLabelResult =
  | { ok: true; trackingNumber: string; labelPath: string }
  | { ok: false; reason: CreateLabelFailureReason; error: string };

export async function createLabelCore(
  orderId: string,
  provider: ShippingProvider = getShippingProvider(),
): Promise<CreateLabelResult> {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, reason: "not_found", error: "Bestellung nicht gefunden." };
  }

  const order = await OrderModel.findById(orderId).lean().exec();
  if (!order) return { ok: false, reason: "not_found", error: "Bestellung nicht gefunden." };

  if (order.status === "shipped" && order.shipping.trackingNumber && order.shipping.labelPath) {
    return {
      ok: true,
      trackingNumber: order.shipping.trackingNumber,
      labelPath: order.shipping.labelPath,
    };
  }
  if (order.status !== "packed") {
    return {
      ok: false,
      reason: "not_packed",
      error: "Ein Etikett kann nur für gepackte Bestellungen erstellt werden.",
    };
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
  if (!label.ok) return { ok: false, reason: "provider_error", error: label.error };

  const updated = transition({ status: order.status, statusLog: order.statusLog }, "shipped", {
    note: `UPS-Sendung ${label.trackingNumber}`,
    by: provider.name,
    viaLabel: true,
  });

  const labelPath = path.join(LABELS_DIR, `${order.orderNumber}.pdf`);
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
    { returnDocument: "after" },
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
    return {
      ok: false,
      reason: "conflict",
      error: "Etikett konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }

  // Write the PDF only after the conditional packed → shipped move won, so losing races
  // never orphan a file.
  await fs.mkdir(path.resolve(LABELS_DIR), { recursive: true });
  await fs.writeFile(path.resolve(labelPath), label.labelPdf);

  return { ok: true, trackingNumber: label.trackingNumber, labelPath };
}
