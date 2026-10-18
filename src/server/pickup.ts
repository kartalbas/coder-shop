import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { flowFlagsFor, transition } from "@/lib/orders/state-machine";
import type { PickupPaymentType } from "@/lib/payments";
import { pickupReadyMail } from "@/lib/mail-templates";
import { STORE } from "@/lib/store";
import { OrderModel, type Order } from "@/models/order";
import { connectDB } from "./db";
import { sendMail } from "./mail";
import { advanceUnitsForOrder } from "./stock-units";

// Handover code the customer shows at the counter (issue #41). 6 characters from an
// unambiguous alphabet (no O/0, I/1) so it survives phone calls and bad handwriting.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generatePickupCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizePickupCode(input: string): string {
  return input.trim().toUpperCase();
}

// Plain equality on normalized codes: the code is not a secret (it stands on the
// confirmation page and in the admin queue), it only prevents handing the wrong
// parcel to the wrong person at the counter.
function codesMatch(expected: string, provided: string): boolean {
  return expected === provided;
}

export interface PickupQueueItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  customerName: string;
  code: string;
  readyAt?: Date;
  itemCount: number;
  totalCents: number;
}

const QUEUE_STATUSES: OrderStatus[] = ["new", "paid", "picking", "ready"];

// The pickup queue (issue #41): every store-pickup order that has not been collected.
export async function listPickupQueueCore(): Promise<PickupQueueItem[]> {
  await connectDB();
  const orders = await OrderModel.find({
    "shipping.storePickup": true,
    status: { $in: QUEUE_STATUSES },
  })
    .sort({ "shipping.pickup.readyAt": 1, createdAt: 1 })
    .limit(200)
    .lean<Order[]>()
    .exec();
  return orders
    .filter((order) => order.shipping.pickup !== undefined)
    .map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      customerName: order.customer.name,
      code: order.shipping.pickup!.code,
      ...(order.shipping.pickup!.readyAt !== undefined && {
        readyAt: order.shipping.pickup!.readyAt,
      }),
      itemCount: order.lines.reduce((sum, line) => sum + line.qty, 0),
      totalCents: order.totals.totalCents,
    }));
}

export type PickupActionResult = { ok: true } | { ok: false; error: string };

// "Bereit zur Abholung" — from `new` or `picking`, conditional on the loaded status.
export async function markPickupReadyCore(
  orderId: string,
  by: string,
): Promise<PickupActionResult> {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return { ok: false, error: "Bestellung nicht gefunden." };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await OrderModel.findById(orderId).session(session).exec();
    if (!order || order.shipping.storePickup !== true || !order.shipping.pickup) {
      await session.abortTransaction();
      return { ok: false, error: "Bestellung nicht gefunden." };
    }
    if (order.status !== "new" && order.status !== "picking") {
      await session.abortTransaction();
      return { ok: false, error: "Nur offene Bestellungen können bereitgestellt werden." };
    }

    const now = new Date();
    const flags = flowFlagsFor({
      paymentKind: order.payment.kind,
      storePickup: true,
    });
    const updated = transition(order.toObject(), "ready", {
      note: "Bereit zur Abholung",
      by,
      at: now,
      ...flags,
    });
    const moved = await OrderModel.updateOne(
      { _id: order._id, status: order.status },
      {
        $set: {
          status: updated.status,
          statusLog: updated.statusLog,
          "shipping.pickup.readyAt": now,
        },
      },
      { session },
    );
    if (moved.matchedCount === 0) {
      await session.abortTransaction();
      return {
        ok: false,
        error: "Die Bestellung wurde zwischenzeitlich geändert. Bitte erneut versuchen.",
      };
    }
    await session.commitTransaction();
    // Issue #44: "lies bereit" mail with the handover code — after the commit, never
    // failing the admin action.
    try {
      await sendMail({
        to: order.customer.email,
        ...pickupReadyMail({
          name: order.customer.name,
          orderNumber: order.orderNumber,
          code: order.shipping.pickup?.code ?? "",
          store: STORE,
        }),
      });
    } catch (error) {
      console.error(`Bestellung ${order.orderNumber}: Abhol-Mail fehlgeschlagen`, error);
    }
    return { ok: true };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Handover at the counter (issue #41): the customer's code must match, the order moves
// `ready → picked_up` through the state machine and the payment is recorded in the same
// transaction (cash or card taken at the counter).
export async function handoverPickupCore(
  orderId: string,
  code: string,
  paymentType: PickupPaymentType,
  by: string,
): Promise<PickupActionResult> {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return { ok: false, error: "Bestellung nicht gefunden." };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await OrderModel.findById(orderId).session(session).exec();
    if (!order || order.shipping.storePickup !== true || !order.shipping.pickup) {
      await session.abortTransaction();
      return { ok: false, error: "Bestellung nicht gefunden." };
    }
    if (order.status !== "ready") {
      await session.abortTransaction();
      return { ok: false, error: "Die Bestellung ist nicht bereit zur Abholung." };
    }
    if (!codesMatch(order.shipping.pickup.code, normalizePickupCode(code))) {
      await session.abortTransaction();
      return { ok: false, error: "Der Abholcode stimmt nicht überein." };
    }

    const now = new Date();
    const flags = flowFlagsFor({
      paymentKind: order.payment.kind,
      storePickup: true,
    });
    const updated = transition(order.toObject(), "picked_up", {
      note: "Abgeholt und bezahlt",
      by,
      at: now,
      viaPickupHandover: true,
      ...flags,
    });
    const wasPaid = order.payment.paidAt !== undefined;
    const moved = await OrderModel.updateOne(
      { _id: order._id, status: "ready" },
      {
        $set: {
          status: updated.status,
          statusLog: updated.statusLog,
          "shipping.pickup.pickedUpAt": now,
          "shipping.pickup.paymentType": paymentType,
          // A card-paid pickup order was already paid at checkout; the on-site one is
          // paid exactly now.
          ...(!wasPaid && { "payment.paidAt": now }),
        },
      },
      { session },
    );
    if (moved.matchedCount === 0) {
      await session.abortTransaction();
      return {
        ok: false,
        error: "Die Bestellung wurde zwischenzeitlich geändert. Bitte erneut versuchen.",
      };
    }
    // Issue #62 (#54): the handover sells the order's serial units.
    await advanceUnitsForOrder(order.orderNumber, "sold", "Abgeholt", session);
    await session.commitTransaction();
    return { ok: true };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
