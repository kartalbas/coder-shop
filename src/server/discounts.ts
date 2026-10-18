import mongoose, { type ClientSession } from "mongoose";
import { discountForSubtotal, isDiscountInWindow, type DiscountDef } from "@/lib/discounts";
import { createFormatters } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { DiscountCodeModel, type DiscountCode } from "@/models/discount-code";
import { DiscountUsageModel } from "@/models/discount-usage";
import { connectDB } from "./db";
import { getIntlLocale, getLabels, getRequestLabels, getRequestLanguage } from "./i18n";

// Discount codes at the server boundary (issue #45). The money math is pure
// (lib/discounts); this module answers "may this code still be used" and books the
// redemption atomically inside the checkout transaction.

export class DiscountRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountRejectedError";
  }
}

function discountDef(doc: DiscountCode): DiscountDef {
  return {
    kind: doc.kind,
    ...(doc.percent !== undefined && { percent: doc.percent }),
    ...(doc.amountCents !== undefined && { amountCents: doc.amountCents }),
    minOrderCents: doc.minOrderCents,
  };
}

export function normalizeDiscountCode(input: string): string {
  return input.trim().toUpperCase();
}

export interface DiscountCheck {
  ok: boolean;
  error?: string;
  discountCents?: number;
  doc?: DiscountCode;
}

// "May this code apply to this basket right now?" — without booking anything.
export async function checkDiscountCore(
  rawCode: string,
  subtotalCents: number,
  customerKey: string | undefined,
  now = new Date(),
  session?: ClientSession,
): Promise<DiscountCheck> {
  // #58: refusals are answered in the request language — the texts are table rows and
  // the {amount} is formatted with that language's Intl locale (#58 review), like the
  // cart/checkout interpolations, so a French page never shows a German-formatted CHF.
  const language = await getRequestLanguage();
  const [labels, intlLocale] = await Promise.all([
    getLabels(language),
    getIntlLocale(language),
  ]);
  const { chf } = createFormatters(intlLocale);
  const code = normalizeDiscountCode(rawCode);
  const invalid = {
    ok: false as const,
    error: label(labels, "shop.action.discountInvalid"),
  };
  if (!code) return invalid;
  const doc = await DiscountCodeModel.findOne({ code }).session(session ?? null).lean<DiscountCode>().exec();
  if (!doc || !isDiscountInWindow(doc, now)) {
    return { ok: false, error: label(labels, "shop.discount.expired") };
  }
  const discountCents = discountForSubtotal(subtotalCents, discountDef(doc));
  if (discountCents === 0) {
    return {
      ok: false,
      error: interpolate(label(labels, "shop.discount.minOrder"), {
        amount: chf(doc.minOrderCents),
      }),
    };
  }
  if (doc.usageLimit !== undefined && doc.usedCount >= doc.usageLimit) {
    return { ok: false, error: label(labels, "shop.discount.exhausted") };
  }
  if (doc.perCustomerOnce && customerKey) {
    const used = await DiscountUsageModel.findById(`${doc.code}|${customerKey}`)
      .session(session ?? null)
      .lean()
      .exec();
    if (used) return { ok: false, error: label(labels, "shop.discount.usedAlready") };
  }
  return { ok: true, discountCents, doc };
}

// Books the redemption inside the checkout transaction: the usage-limit increment is a
// conditional write (the loser of a race gets 0 modified and the order aborts), and the
// per-customer usage document is unique on (code, customer) — a duplicate aborts too.
// Any later abort of the transaction rolls both back.
export async function redeemDiscount(
  doc: DiscountCode,
  customerKey: string,
  orderNumber: string,
  session: ClientSession,
): Promise<void> {
  const labels = await getRequestLabels();
  const limitGuard =
    doc.usageLimit === undefined ? {} : { usedCount: { $lt: doc.usageLimit } };
  const inc = await DiscountCodeModel.updateOne(
    { _id: doc._id, active: true, ...limitGuard },
    { $inc: { usedCount: 1 } },
    { session },
  );
  if (inc.modifiedCount === 0) {
    throw new DiscountRejectedError(label(labels, "shop.discount.exhausted"));
  }
  if (doc.perCustomerOnce) {
    try {
      await DiscountUsageModel.create(
        [
          {
            _id: `${doc.code}|${customerKey}`,
            code: doc.code,
            customerKey,
            orderNumber,
            at: new Date(),
          },
        ],
        { session },
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new DiscountRejectedError(label(labels, "shop.discount.usedAlready"));
      }
      throw error;
    }
  }
}

// ---------- admin management ----------

export interface DiscountRow {
  id: string;
  code: string;
  description: string;
  kind: "percent" | "fixed";
  percent?: number;
  amountCents?: number;
  minOrderCents: number;
  validFrom?: Date;
  validTo?: Date;
  usageLimit?: number;
  usedCount: number;
  customerCount: number;
  perCustomerOnce: boolean;
  active: boolean;
}

export async function listDiscountsCore(): Promise<DiscountRow[]> {
  await connectDB();
  const codes = await DiscountCodeModel.find().sort({ createdAt: -1 }).limit(200).lean().exec();
  if (codes.length === 0) return [];
  const distinct = await DiscountUsageModel.aggregate<{ _id: string; customers: number }>([
    { $match: { code: { $in: codes.map((code) => code.code) } } },
    { $group: { _id: "$code", customers: { $addToSet: "$customerKey" } } },
    { $project: { customers: { $size: "$customers" } } },
  ]);
  const customerCounts = new Map(distinct.map((row) => [row._id, row.customers]));
  return codes.map((code) => ({
    id: code._id.toString(),
    code: code.code,
    description: code.description ?? "",
    kind: code.kind,
    ...(code.percent !== undefined && { percent: code.percent }),
    ...(code.amountCents !== undefined && { amountCents: code.amountCents }),
    minOrderCents: code.minOrderCents,
    ...(code.validFrom !== undefined && { validFrom: code.validFrom }),
    ...(code.validTo !== undefined && { validTo: code.validTo }),
    ...(code.usageLimit !== undefined && { usageLimit: code.usageLimit }),
    usedCount: code.usedCount,
    customerCount: customerCounts.get(code.code) ?? 0,
    perCustomerOnce: code.perCustomerOnce,
    active: code.active,
  }));
}

export interface CreateDiscountInput {
  code: string;
  description?: string;
  kind: "percent" | "fixed";
  percent?: number;
  amountCents?: number;
  minOrderCents: number;
  validFrom?: Date;
  validTo?: Date;
  usageLimit?: number;
  perCustomerOnce: boolean;
}

export type DiscountActionResult = { ok: true } | { ok: false; error: string };

// #58 step 5: the admin management refusals answer from the table in the request
// language; outside a request scope the first active language (German) answers.
export async function createDiscountCore(input: CreateDiscountInput): Promise<DiscountActionResult> {
  const labels = await getRequestLabels();
  await connectDB();
  const code = normalizeDiscountCode(input.code);
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) {
    return { ok: false, error: label(labels, "admin.discounts.error.codeShape") };
  }
  if (input.kind === "percent" && (!input.percent || input.percent < 1 || input.percent > 100)) {
    return { ok: false, error: label(labels, "admin.discounts.error.percentMissing") };
  }
  if (input.kind === "fixed" && (!input.amountCents || input.amountCents < 1)) {
    return { ok: false, error: label(labels, "admin.discounts.error.amountMissing") };
  }
  if (input.validFrom && input.validTo && input.validFrom > input.validTo) {
    return { ok: false, error: label(labels, "admin.discounts.error.dateOrder") };
  }
  try {
    await DiscountCodeModel.create({ ...input, code });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return { ok: false, error: label(labels, "admin.discounts.error.duplicate") };
    }
    throw error;
  }
  return { ok: true };
}

export async function setDiscountActiveCore(
  id: string,
  active: boolean,
): Promise<DiscountActionResult> {
  const notFound = label(await getRequestLabels(), "admin.error.codeNotFound");
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: notFound };
  const updated = await DiscountCodeModel.updateOne({ _id: id }, { $set: { active } }).exec();
  if (updated.matchedCount === 0) return { ok: false, error: notFound };
  return { ok: true };
}
