import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { interpolate, label } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { escapeRegex } from "@/lib/regex";
import { localizedPath } from "@/lib/locale-path";
import { absoluteUrl } from "@/lib/site";
import { passwordResetMail } from "@/lib/mail-templates";
import { OrderModel, type Order } from "@/models/order";
import { PasswordResetModel } from "@/models/password-reset";
import { UserModel, type CustomerAddress } from "@/models/user";
import { connectDB } from "./db";
import { hashResetToken, RESET_TOKEN_TTL_MS } from "./customers";
import { getRequestLabels } from "./i18n";
import { getMailContext } from "./mail-context";
import { listInvoicesForUser } from "./invoices";
import { sendMail } from "./mail";

// The internal note ceiling — the action schema and the refusal text share it.
export const MAX_CUSTOMER_NOTE_LENGTH = 2000;

// Admin customer management (issue #43): the list answers "who buys here and what do
// they still owe", the detail page collects everything about one account.

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  blocked: boolean;
  orderCount: number;
  openInvoiceCents: number;
}

export async function listCustomersCore(query: string): Promise<AdminCustomerRow[]> {
  await connectDB();
  const filter: Record<string, unknown> = { role: "customer" };
  const trimmed = query.trim();
  if (trimmed) {
    const regex = { $regex: escapeRegex(trimmed), $options: "i" };
    filter.$or = [{ name: regex }, { email: regex }];
  }
  const users = await UserModel.find(filter)
    .select("name email blocked")
    .sort({ name: 1 })
    .limit(100)
    .lean()
    .exec();
  if (users.length === 0) return [];

  const ids = users.map((user) => user._id);
  const emails = users.map((user) => user.email);
  // Orders per customer — by account link or by the e-mail they check out with.
  const [orderRows, invoiceRows] = await Promise.all([
    OrderModel.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $ne: "cancelled" }, $or: [{ userId: { $in: ids } }, { "customer.email": { $in: emails } }] } },
      {
        $addFields: {
          key: {
            $cond: [{ $ifNull: ["$userId", false] }, { $toString: "$userId" }, "$customer.email"],
          },
        },
      },
      { $group: { _id: "$key", count: { $sum: 1 } } },
    ]),
    OrderModel.aggregate<{ _id: string; open: number }>([
      {
        $match: {
          "payment.kind": "invoice",
          status: { $ne: "cancelled" },
          $or: [{ userId: { $in: ids } }, { "customer.email": { $in: emails } }],
        },
      },
      {
        $addFields: {
          key: {
            $cond: [{ $ifNull: ["$userId", false] }, { $toString: "$userId" }, "$customer.email"],
          },
          open: { $subtract: ["$totals.totalCents", "$payment.invoice.paidCents"] },
        },
      },
      { $group: { _id: "$key", open: { $sum: "$open" } } },
    ]),
  ]);
  // A customer's orders can be split across both keys — linked orders group by userId,
  // guest orders with the same e-mail by e-mail — so the two buckets are summed.
  const counts = new Map(orderRows.map((row) => [row._id, row.count]));
  const open = new Map(invoiceRows.map((row) => [row._id, row.open]));
  const sum = (map: Map<string, number>, user: { _id: mongoose.Types.ObjectId; email: string }) =>
    (map.get(user._id.toString()) ?? 0) + (map.get(user.email) ?? 0);

  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    blocked: user.blocked === true,
    orderCount: sum(counts, user),
    openInvoiceCents: Math.max(0, sum(open, user)),
  }));
}

export interface AdminCustomerDetail {
  id: string;
  name: string;
  email: string;
  blocked: boolean;
  notes: string;
  creditLimitCents: number | undefined;
  openInvoices: { orderId: string; orderNumber: string; openCents: number; dueAt: Date; overdue: boolean }[];
  openTotalCents: number;
  addresses: CustomerAddress[];
  orders: { id: string; orderNumber: string; status: OrderStatus; totalCents: number; createdAt: Date }[];
}

export async function getCustomerDetailCore(id: string): Promise<AdminCustomerDetail | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  const user = await UserModel.findById(id)
    .select("name email role blocked notes creditLimitCents addresses")
    .lean()
    .exec();
  if (!user || user.role !== "customer") return null;

  const [invoices, orders] = await Promise.all([
    listInvoicesForUser(id),
    OrderModel.find({
      $or: [{ userId: user._id }, { "customer.email": user.email }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("orderNumber status totals createdAt")
      .lean<Order[]>()
      .exec(),
  ]);
  const open = invoices.filter((invoice) => !invoice.paid);
  // The admin order detail is addressed by id — resolve the open invoices' ids.
  const openNumberToId = new Map(
    orders
      .filter((order) => open.some((invoice) => invoice.orderNumber === order.orderNumber))
      .map((order) => [order.orderNumber, order._id.toString()]),
  );
  return {
    id,
    name: user.name,
    email: user.email,
    blocked: user.blocked === true,
    notes: user.notes ?? "",
    creditLimitCents: user.creditLimitCents,
    openInvoices: open.map((invoice) => ({
      orderId: openNumberToId.get(invoice.orderNumber) ?? "",
      orderNumber: invoice.orderNumber,
      openCents: invoice.openCents,
      dueAt: invoice.dueAt,
      overdue: invoice.overdue,
    })),
    openTotalCents: open.reduce((sum, invoice) => sum + invoice.openCents, 0),
    addresses: user.addresses ?? [],
    orders: orders.map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totals.totalCents,
      createdAt: order.createdAt,
    })),
  };
}

export type CustomerActionResult = { ok: true } | { ok: false; error: string };

// #58 step 5: refusals answer from the translation table in the request language;
// outside a request scope the first active language (German) answers.
export async function setCustomerBlockedCore(
  id: string,
  blocked: boolean,
): Promise<CustomerActionResult> {
  const labels = await getRequestLabels();
  const notFound = label(labels, "admin.error.customerNotFound");
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: notFound };
  const updated = await UserModel.updateOne(
    { _id: id, role: "customer" },
    { $set: { blocked } },
  ).exec();
  if (updated.matchedCount === 0) return { ok: false, error: notFound };
  // A block also signs the customer out everywhere (issue #6 mechanism).
  if (blocked) await UserModel.updateOne({ _id: id }, { $set: { sessionsInvalidBefore: new Date() } });
  return { ok: true };
}

export async function setCustomerNotesCore(id: string, notes: string): Promise<CustomerActionResult> {
  const labels = await getRequestLabels();
  const notFound = label(labels, "admin.error.customerNotFound");
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: notFound };
  if (notes.length > MAX_CUSTOMER_NOTE_LENGTH) {
    return {
      ok: false,
      error: interpolate(label(labels, "admin.customers.error.noteTooLong"), {
        max: MAX_CUSTOMER_NOTE_LENGTH,
      }),
    };
  }
  const updated = await UserModel.updateOne(
    { _id: id, role: "customer" },
    { $set: { notes: notes.trim() } },
  ).exec();
  if (updated.matchedCount === 0) return { ok: false, error: notFound };
  return { ok: true };
}

// Admin-initiated password reset (issue #43): same single-use hashed token as the
// self-service flow, mailed to the customer — the admin never sees a password.
export async function adminResetPasswordCore(id: string): Promise<CustomerActionResult> {
  const labels = await getRequestLabels();
  const notFound = label(labels, "admin.error.customerNotFound");
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: notFound };
  const user = await UserModel.findById(id).select("name email role language").lean().exec();
  if (!user || user.role !== "customer") return { ok: false, error: notFound };
  const token = randomBytes(32).toString("base64url");
  await PasswordResetModel.create({
    _id: hashResetToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  // #58 decision point 3: the admin acts, the customer is answered — the mail renders
  // in the account's language, not the admin's.
  const ctx = await getMailContext(user.language);
  const link = absoluteUrl(
    localizedPath(ctx.language, `/account/reset-password?token=${token}`),
  );
  await sendMail({ to: user.email, ...passwordResetMail(ctx, user.name, link) });
  return { ok: true };
}
