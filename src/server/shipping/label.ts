import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { parcelWeightGrams } from "@/lib/shipping/weight";
import type { LabelRequest, ShippingProvider } from "@/lib/shipping/types";
import { transition } from "@/lib/orders/state-machine";
import { shippedMail } from "@/lib/mail-templates";
import { localizedPath } from "@/lib/locale-path";
import { absoluteUrl } from "@/lib/site";
import { label } from "@/lib/i18n";
import { OrderModel, type Order } from "@/models/order";
import { connectDB } from "../db";
import { getRequestLabels } from "../i18n";
import { getMailContext } from "../mail-context";
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
  // Issue #58 step 2: refusals answer in the request language; the stored statusLog
  // notes ("UPS-Sendung …", "Etikett erstellt") stay German — stored data, recorded.
  const labels = await getRequestLabels();
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, reason: "not_found", error: label(labels, "admin.error.orderNotFound") };
  }

  const order = await OrderModel.findById(orderId).lean<Order>().exec();
  if (!order) {
    return { ok: false, reason: "not_found", error: label(labels, "admin.error.orderNotFound") };
  }

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
      error: label(labels, "admin.label.error.notPacked"),
    };
  }

  const weight = parcelWeightGrams(order.lines);
  // #58 decision point 3: the parcel goes to the customer, so the printed label texts
  // render from the table in the *order's* stored language — one resolution feeds the
  // label map handed to the provider and the tracking mail below, never the admin's.
  const ctx = await getMailContext(order.language);
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
    // #62 review: the UPS service level follows the behavior flag stored on the order
    // at checkout (like storePickup) — a method key never appears in the label path.
    service: order.shipping.expressService === true ? "express" : "standard",
    // Issue #62 (#54): the serial-tracked pieces of the parcel travel on the label data
    // too (packing slip and invoice already carry them); quantity orders have none.
    serials: order.lines.flatMap((line) => line.serials ?? []),
    labels: ctx.labels,
  };

  const shipment = await provider.createLabel(labelRequest);
  if (!shipment.ok) return { ok: false, reason: "provider_error", error: shipment.error };

  const updated = transition({ status: order.status, statusLog: order.statusLog }, "shipped", {
    note: `UPS-Sendung ${shipment.trackingNumber}`,
    by: provider.name,
    viaLabel: true,
  });

  // Issue #16: the PDF must exist on disk before the order moves to shipped — an order is
  // never shipped with a label path that 404s. A failed write keeps the order `packed` and
  // is retryable; a lost race cleans the file up again.
  const labelPath = path.join(LABELS_DIR, `${order.orderNumber}.pdf`);
  try {
    await fs.mkdir(path.resolve(LABELS_DIR), { recursive: true });
    await fs.writeFile(path.resolve(labelPath), shipment.labelPdf);
  } catch {
    return {
      ok: false,
      reason: "storage_error",
      error: label(labels, "admin.label.error.storage"),
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
          expressService: order.shipping.expressService,
          carrier: "ups" as const,
          trackingNumber: shipment.trackingNumber,
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
      error: label(labels, "admin.label.error.conflict"),
    };
  }

  // Issue #62 (#54): the label-only `packed → shipped` moves the order's serial
  // units along; quantity orders have no units and nothing happens.
  await advanceUnitsForOrder(order.orderNumber, "shipped", "Etikett erstellt");

  // Issue #44: the tracking mail only after the order actually moved to shipped (not on
  // the idempotent early return) — and never fails the label flow. #58 decision point 3:
  // it renders in the *order's* language (the context resolved for the label above),
  // not the admin's; the carrier code rides along as data.
  try {
    await sendMail({
      to: order.customer.email,
      ...shippedMail(ctx, {
        name: order.customer.name,
        orderNumber: order.orderNumber,
        trackingNumber: shipment.trackingNumber,
        carrier: (order.shipping.carrier ?? provider.name).toUpperCase(),
        link: absoluteUrl(localizedPath(ctx.language, `/orders/${order.orderNumber}`)),
      }),
    });
  } catch (error) {
    console.error(`Bestellung ${order.orderNumber}: Versand-Mail fehlgeschlagen`, error);
  }

  return { ok: true, trackingNumber: shipment.trackingNumber, labelPath };
}

export type LabelFileResult =
  | { ok: true; orderNumber: string; pdf: Buffer }
  | { ok: false; status: 400 | 404; error: string };

// Data access for the admin label download route (issue #32): the route keeps only the
// session guard and the response mapping; look-up, path containment and file read live here.
export async function getLabelFileCore(orderId: string): Promise<LabelFileResult> {
  const labels = await getRequestLabels();
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, status: 404, error: label(labels, "admin.error.orderNotFound") };
  }
  await connectDB();
  const order = await OrderModel.findById(orderId)
    .select("orderNumber shipping.labelPath")
    .lean()
    .exec();
  if (!order?.shipping.labelPath) {
    return { ok: false, status: 404, error: label(labels, "admin.label.error.missing") };
  }
  const file = resolveInsideDir(LABELS_DIR, order.shipping.labelPath);
  if (!file) {
    return { ok: false, status: 400, error: label(labels, "admin.label.error.invalidPath") };
  }
  try {
    return { ok: true, orderNumber: order.orderNumber, pdf: await fs.readFile(file) };
  } catch {
    return { ok: false, status: 404, error: label(labels, "admin.label.error.fileMissing") };
  }
}
