import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { parcelWeightGrams } from "@/lib/shipping/weight";
import type { LabelRequest, ShippingProvider } from "@/lib/shipping/types";
import { transition } from "@/lib/orders/state-machine";
import { shippedMail } from "@/lib/mail-templates";
import { absoluteUrl } from "@/lib/site";
import { OrderModel, type Order } from "@/models/order";
import { connectDB } from "../db";
import { sendMail } from "../mail";
import { advanceUnitsForOrder } from "../stock-units";
import { resolveInsideDir } from "../secure-path";
import { getShippingProvider } from "./provider";

export const LABELS_DIR = path.join("data", "labels");

type CreateLabelFailureReason =
  | "not_found"
  | "not_packed"
  | "provider_error"
  | "storage_error"
  | "conflict";

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

  const order = await OrderModel.findById(orderId).lean<Order>().exec();
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
    // The UPS service level follows the configured method key (express ships express).
    service: order.shipping.method === "express" ? "express" : "standard",
    // Issue #62 (#54): the serial-tracked pieces of the parcel travel on the label data
    // too (packing slip and invoice already carry them); quantity orders have none.
    serials: order.lines.flatMap((line) => line.serials ?? []),
  };

  const label = await provider.createLabel(labelRequest);
  if (!label.ok) return { ok: false, reason: "provider_error", error: label.error };

  const updated = transition({ status: order.status, statusLog: order.statusLog }, "shipped", {
    note: `UPS-Sendung ${label.trackingNumber}`,
    by: provider.name,
    viaLabel: true,
  });

  // Issue #16: the PDF must exist on disk before the order moves to shipped — an order is
  // never shipped with a label path that 404s. A failed write keeps the order `packed` and
  // is retryable; a lost race cleans the file up again.
  const labelPath = path.join(LABELS_DIR, `${order.orderNumber}.pdf`);
  try {
    await fs.mkdir(path.resolve(LABELS_DIR), { recursive: true });
    await fs.writeFile(path.resolve(labelPath), label.labelPdf);
  } catch {
    return {
      ok: false,
      reason: "storage_error",
      error: "Das Etikett konnte nicht gespeichert werden. Die Bestellung bleibt «gepackt» — bitte erneut versuchen.",
    };
  }

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
    await fs.rm(path.resolve(labelPath), { force: true }).catch(() => {});
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

  // Issue #62 (#54): the label-only `packed → shipped` moves the order's serial
  // units along; quantity orders have no units and nothing happens.
  await advanceUnitsForOrder(order.orderNumber, "shipped", "Etikett erstellt");

  // Issue #44: the tracking mail only after the order actually moved to shipped (not on
  // the idempotent early return) — and never fails the label flow.
  try {
    await sendMail({
      to: order.customer.email,
      ...shippedMail({
        name: order.customer.name,
        orderNumber: order.orderNumber,
        trackingNumber: label.trackingNumber,
        link: absoluteUrl(`/orders/${order.orderNumber}`),
      }),
    });
  } catch (error) {
    console.error(`Bestellung ${order.orderNumber}: Versand-Mail fehlgeschlagen`, error);
  }

  return { ok: true, trackingNumber: label.trackingNumber, labelPath };
}

export type LabelFileResult =
  | { ok: true; orderNumber: string; pdf: Buffer }
  | { ok: false; status: 400 | 404; error: string };

// Data access for the admin label download route (issue #32): the route keeps only the
// session guard and the response mapping; look-up, path containment and file read live here.
export async function getLabelFileCore(orderId: string): Promise<LabelFileResult> {
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, status: 404, error: "Bestellung nicht gefunden." };
  }
  await connectDB();
  const order = await OrderModel.findById(orderId)
    .select("orderNumber shipping.labelPath")
    .lean()
    .exec();
  if (!order?.shipping.labelPath) {
    return { ok: false, status: 404, error: "Kein Etikett vorhanden." };
  }
  const file = resolveInsideDir(LABELS_DIR, order.shipping.labelPath);
  if (!file) {
    return { ok: false, status: 400, error: "Ungültiger Etiketten-Pfad." };
  }
  try {
    return { ok: true, orderNumber: order.orderNumber, pdf: await fs.readFile(file) };
  } catch {
    return { ok: false, status: 404, error: "Etikettdatei fehlt auf dem Server." };
  }
}
