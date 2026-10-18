import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose, { type ClientSession } from "mongoose";
import {
  DEFAULT_CREDIT_LIMIT_CENTS,
  isInvoiceOverdue,
  isInvoicePaid,
  openAmountCents,
} from "@/lib/invoices";
import { formatChf } from "@/lib/format";
import { invoiceReminderMail } from "@/lib/mail-templates";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { transition } from "@/lib/orders/state-machine";
import { OrderModel, type Order } from "@/models/order";
import { UserModel } from "@/models/user";
import { interpolate, label } from "@/lib/i18n";
import { connectDB } from "./db";
import { getRequestLabels } from "./i18n";
import { getMailContext } from "./mail-context";
import { sendMail } from "./mail";
import { buildInvoicePdf } from "./invoices-pdf";
import { getShopSettings } from "./shop-settings";
import { resolveInsideDir } from "./secure-path";

// Open invoices of one account occupy their credit (issue #40): every non-cancelled
// invoice order contributes its unpaid remainder, whatever its workflow status is.
export async function getInvoiceCreditUsageCents(
  userId: string,
  session?: ClientSession,
): Promise<number> {
  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        "payment.kind": "invoice",
        status: { $ne: "cancelled" },
      },
    },
    {
      $project: {
        openCents: {
          $max: [{ $subtract: ["$totals.totalCents", { $ifNull: ["$payment.invoice.paidCents", 0] }] }, 0],
        },
      },
    },
    { $group: { _id: null, total: { $sum: "$openCents" } } },
  ];
  const rows = session
    ? await OrderModel.aggregate<{ total: number }>(pipeline).session(session)
    : await OrderModel.aggregate<{ total: number }>(pipeline);
  return Math.max(0, rows[0]?.total ?? 0);
}

export async function getCreditLimitCents(userId: string): Promise<number> {
  const user = await UserModel.findById(userId).select("creditLimitCents").lean().exec();
  return user?.creditLimitCents ?? DEFAULT_CREDIT_LIMIT_CENTS;
}

export type InvoiceFilter = "all" | "open" | "overdue" | "paid";

export interface InvoiceListItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  createdAt: Date;
  totalCents: number;
  paidCents: number;
  openCents: number;
  dueAt: Date;
  overdue: boolean;
  paidAt?: Date;
  reminder1At?: Date;
  reminder2At?: Date;
}

function toListItem(order: Order, now: Date): InvoiceListItem {
  const invoice = order.payment.invoice;
  const totalCents = order.totals.totalCents;
  const paidCents = invoice?.paidCents ?? 0;
  return {
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    status: order.status,
    createdAt: order.createdAt,
    totalCents,
    paidCents,
    openCents: openAmountCents(totalCents, paidCents),
    dueAt: invoice?.dueAt ?? order.createdAt,
    overdue:
      invoice !== undefined &&
      isInvoiceOverdue({ dueAt: invoice.dueAt, totalCents, paidCents, now }),
    ...(order.payment.paidAt !== undefined && { paidAt: order.payment.paidAt }),
    ...(invoice?.reminder1At !== undefined && { reminder1At: invoice.reminder1At }),
    ...(invoice?.reminder2At !== undefined && { reminder2At: invoice.reminder2At }),
  };
}

async function findInvoiceOrders(filter: InvoiceFilter, now: Date): Promise<InvoiceListItem[]> {
  const query: Record<string, unknown> = { "payment.kind": "invoice" };
  if (filter === "open") query["payment.paidAt"] = null;
  if (filter === "paid") query["payment.paidAt"] = { $ne: null };
  const orders = await OrderModel.find(query)
    .sort({ "payment.invoice.dueAt": 1, createdAt: -1 })
    .limit(500)
    .lean<Order[]>()
    .exec();
  const items = orders
    .filter((order) => order.payment.invoice !== undefined)
    .map((order) => toListItem(order, now));
  if (filter === "overdue") return items.filter((item) => item.overdue);
  return items;
}

// Admin invoice list (issue #40): cancelled orders are not invoices anyone waits for.
export async function listInvoices(filter: InvoiceFilter): Promise<InvoiceListItem[]> {
  await connectDB();
  const items = await findInvoiceOrders(filter, new Date());
  return items.filter((item) => item.status !== "cancelled");
}

export interface CustomerInvoice {
  orderNumber: string;
  createdAt: Date;
  totalCents: number;
  paidCents: number;
  openCents: number;
  dueAt: Date;
  overdue: boolean;
  paid: boolean;
}

// "Offene Rechnungen" in the customer portal: the account's own invoice orders,
// open ones first (by due date), then the settled history.
export async function listInvoicesForUser(userId: string): Promise<CustomerInvoice[]> {
  await connectDB();
  const user = await UserModel.findById(userId).select("email").lean().exec();
  if (!user) return [];
  const now = new Date();
  const orders = await OrderModel.find({
    "payment.kind": "invoice",
    status: { $ne: "cancelled" },
    $or: [{ userId }, { "customer.email": user.email }],
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<Order[]>()
    .exec();
  const items = orders
    .filter((order) => order.payment.invoice !== undefined)
    .map((order) => {
      const invoice = order.payment.invoice!;
      const totalCents = order.totals.totalCents;
      const paidCents = invoice.paidCents;
      return {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        totalCents,
        paidCents,
        openCents: openAmountCents(totalCents, paidCents),
        dueAt: invoice.dueAt,
        overdue: isInvoiceOverdue({ dueAt: invoice.dueAt, totalCents, paidCents, now }),
        paid: isInvoicePaid(totalCents, paidCents),
      };
    });
  return items.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

export type InvoiceActionResult = { ok: true } | { ok: false; error: string };

// The admin sets a personal invoice credit per customer (issue #40); the amount is in
// integer cents, 0 blocks invoice payment for that account.
export async function setCreditLimitCore(
  userId: string,
  creditLimitCents: number,
): Promise<InvoiceActionResult> {
  const labels = await getRequestLabels();
  await connectDB();
  if (!mongoose.isValidObjectId(userId)) {
    return { ok: false, error: label(labels, "admin.invoices.error.customerNotFound") };
  }
  if (!Number.isInteger(creditLimitCents) || creditLimitCents < 0) {
    return { ok: false, error: label(labels, "admin.invoices.error.invalidAmount") };
  }
  const moved = await UserModel.updateOne(
    { _id: userId, role: "customer" },
    { $set: { creditLimitCents } },
  );
  if (moved.matchedCount === 0) {
    return { ok: false, error: label(labels, "admin.invoices.error.customerNotFound") };
  }
  return { ok: true };
}

export interface CustomerCreditRow {
  userId: string;
  name: string;
  email: string;
  creditLimitCents: number;
  usedCents: number;
}

// Credit overview of the invoice page: every account that has invoice orders, with the
// open amount against its limit.
export async function listInvoiceCredits(): Promise<CustomerCreditRow[]> {
  await connectDB();
  const rows = await OrderModel.aggregate<{ userId: mongoose.Types.ObjectId }>([
    { $match: { "payment.kind": "invoice", userId: { $ne: null } } },
    { $group: { _id: "$userId", userId: { $first: "$userId" } } },
    { $sort: { _id: 1 } },
    { $limit: 200 },
  ]);
  const userIds = rows.map((row) => row.userId.toString());
  if (userIds.length === 0) return [];
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("name email creditLimitCents")
    .lean()
    .exec();
  const credits = await Promise.all(
    users.map(async (user) => ({
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      creditLimitCents: user.creditLimitCents ?? DEFAULT_CREDIT_LIMIT_CENTS,
      usedCents: await getInvoiceCreditUsageCents(user._id.toString()),
    })),
  );
  return credits.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

// Partial payments are explicit (issue #40): every amount up to the open balance is
// accepted; only the full amount settles the invoice and (for a still-unpaid order)
// moves it to "paid" through the state machine.
export async function recordInvoicePaymentCore(
  orderId: string,
  amountCents: number,
  by: string,
): Promise<InvoiceActionResult> {
  const labels = await getRequestLabels();
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, error: label(labels, "admin.invoices.error.notFound") };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: label(labels, "admin.invoices.error.amountPositive") };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await OrderModel.findById(orderId).session(session).exec();
    const invoice = order?.payment.invoice;
    if (!order || !invoice || order.payment.kind !== "invoice") {
      await session.abortTransaction();
      return { ok: false, error: label(labels, "admin.invoices.error.notFound") };
    }
    if (order.status === "cancelled") {
      await session.abortTransaction();
      return { ok: false, error: label(labels, "admin.invoices.error.cancelled") };
    }
    const open = openAmountCents(order.totals.totalCents, invoice.paidCents);
    if (amountCents > open) {
      await session.abortTransaction();
      return {
        ok: false,
        error: interpolate(label(labels, "admin.invoices.error.amountExceeds"), {
          amount: formatChf(open),
        }),
      };
    }

    const paidCents = invoice.paidCents + amountCents;
    const settled = isInvoicePaid(order.totals.totalCents, paidCents);
    const now = new Date();
    const update: Record<string, unknown> = {
      "payment.invoice.paidCents": paidCents,
      ...(settled && { "payment.paidAt": now }),
    };

    if (settled && order.status === "new") {
      const updated = transition(order.toObject(), "paid", {
        viaInvoicePayment: true,
        processBeforePayment: true,
        note: "Rechnung bezahlt",
        by,
        at: now,
      });
      update.status = updated.status;
      update.statusLog = updated.statusLog;
      const moved = await OrderModel.updateOne(
        { _id: order._id, status: "new" },
        { $set: update },
        { session },
      );
      if (moved.matchedCount === 0) {
        await session.abortTransaction();
        return { ok: false, error: label(labels, "admin.orders.error.conflict") };
      }
    } else {
      await OrderModel.updateOne({ _id: order._id }, { $set: update }, { session });
    }

    await session.commitTransaction();
    return { ok: true };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Reminder levels (issue #40): only overdue open invoices, the 2nd only after the 1st,
// each level once — and the mail goes to the dev outbox.
export async function sendInvoiceReminderCore(
  orderId: string,
  level: 1 | 2,
): Promise<InvoiceActionResult> {
  const labels = await getRequestLabels();
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) {
    return { ok: false, error: label(labels, "admin.invoices.error.notFound") };
  }

  const order = await OrderModel.findById(orderId).exec();
  const invoice = order?.payment.invoice;
  if (!order || !invoice || order.payment.kind !== "invoice") {
    return { ok: false, error: label(labels, "admin.invoices.error.notFound") };
  }
  if (order.status === "cancelled") {
    return { ok: false, error: label(labels, "admin.invoices.error.cancelled") };
  }
  const open = openAmountCents(order.totals.totalCents, invoice.paidCents);
  if (open === 0) return { ok: false, error: label(labels, "admin.invoices.error.paid") };
  const now = new Date();
  if (!isInvoiceOverdue({ dueAt: invoice.dueAt, totalCents: order.totals.totalCents, paidCents: invoice.paidCents, now })) {
    return { ok: false, error: label(labels, "admin.invoices.error.notOverdue") };
  }
  if (level === 1 && invoice.reminder1At) {
    return { ok: false, error: label(labels, "admin.invoices.error.reminder1Sent") };
  }
  if (level === 2) {
    if (!invoice.reminder1At) {
      return { ok: false, error: label(labels, "admin.invoices.error.reminder1First") };
    }
    if (invoice.reminder2At) {
      return { ok: false, error: label(labels, "admin.invoices.error.reminder2Sent") };
    }
  }

  const field = level === 1 ? "payment.invoice.reminder1At" : "payment.invoice.reminder2At";
  const moved = await OrderModel.updateOne(
    { _id: order._id, [field]: null },
    { $set: { [field]: now } },
  );
  if (moved.matchedCount === 0) {
    return { ok: false, error: label(labels, "admin.invoices.error.changed") };
  }

  await sendMail({
    to: order.customer.email,
    // #58 decision point 3: the reminder renders in the order's language, not the admin's.
    ...invoiceReminderMail(await getMailContext(order.language), order.customer.name, order.orderNumber, open, level),
  });
  return { ok: true };
}

const INVOICES_DIR = path.resolve("data/invoices");

// The invoice PDF (issue #40) is generated on demand into data/invoices (outside the
// web root — it contains PII) and served by the guarded routes only.
export async function getInvoiceFileCore(
  orderNumber: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  await connectDB();
  const order = await OrderModel.findOne({ orderNumber }).lean<Order>().exec();
  if (!order || order.payment.kind !== "invoice" || !order.payment.invoice) return null;

  const fileName = `${order.orderNumber}.pdf`;
  const filePath = resolveInsideDir(INVOICES_DIR, path.join(INVOICES_DIR, fileName));
  if (!filePath) return null;
  try {
    return { buffer: await readFile(filePath), fileName };
  } catch {
    // not generated yet — build it below
  }
  const pdf = await buildInvoicePdf(order, (await getShopSettings()).vatRatePercent);
  await mkdir(INVOICES_DIR, { recursive: true });
  await writeFile(filePath, pdf);
  return { buffer: Buffer.from(pdf), fileName };
}

// Same file addressed by order id (the admin list knows ids, the portal knows numbers).
export async function getInvoiceFileByIdCore(
  orderId: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(orderId)) return null;
  const order = await OrderModel.findById(orderId).select("orderNumber").lean<Order>().exec();
  if (!order) return null;
  return getInvoiceFileCore(order.orderNumber);
}
