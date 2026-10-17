import { createHash } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { DEFAULT_CREDIT_LIMIT_CENTS, invoiceDueAt, qrReferenceForOrder } from "@/lib/invoices";
import { formatOrderNumber, formatPaymentReference } from "@/lib/numbers";
import type { PaymentMethodName } from "@/lib/payments";
import { transition, type OrderStatus } from "@/lib/orders/state-machine";
import { computeTotals, type ShippingMethodName, type Totals } from "@/lib/pricing";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { CheckoutClaimModel } from "@/models/checkout-claim";
import {
  OrderModel,
  type Order,
  type OrderCustomer,
  type OrderLine,
  type StatusLogEntry,
} from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { UserModel } from "@/models/user";
import { connectDB } from "./db";
import { getInvoiceCreditUsageCents } from "./invoices";
import { mintNumber } from "./numbers";

export type CreateOrderResult =
  | { ok: true; orderNumber: string; totals: Totals }
  | {
      ok: false;
      error: string;
      reason?: "price_changed";
      changed?: { sku: string; unitPriceCents: number }[];
    };

class InsufficientStockError extends Error {
  constructor(readonly sku: string) {
    super(`Not enough stock for ${sku}`);
    this.name = "InsufficientStockError";
  }
}

// The database price no longer matches what the checkout page displayed (issue #12).
class PriceChangedError extends Error {
  constructor(readonly changed: { sku: string; unitPriceCents: number }[]) {
    super(`Prices changed for: ${changed.map((c) => c.sku).join(", ")}`);
    this.name = "PriceChangedError";
  }
}

// Invoice orders need a registered account and must stay inside its credit limit
// (issue #40) — checked inside the transaction against the real totals.
class InvoiceNotEligibleError extends Error {
  constructor(readonly reason: "no_account" | "credit_exceeded") {
    super(`Invoice not eligible: ${reason}`);
    this.name = "InvoiceNotEligibleError";
  }
}

function isTransientError(error: unknown): boolean {
  const e = error as {
    hasErrorLabel?: (label: string) => boolean;
    code?: number;
    message?: string;
  };
  if (typeof e?.hasErrorLabel === "function" && e.hasErrorLabel("TransientTransactionError")) {
    return true;
  }
  if (e?.code === 112) return true;
  return /write conflict|transienttransaction/i.test(e?.message ?? "");
}

interface ResolvedLine {
  productId: mongoose.Types.ObjectId;
  sku: string;
  qty: number;
  name: string;
  variantLabel: string;
  unitPriceCents: number;
  expectedUnitPriceCents: number;
  weightGrams: number;
}

function mergeLines(lines: CheckoutInput["lines"]): Map<string, { qty: number; expectedUnitPriceCents: number }> {
  const bySku = new Map<string, { qty: number; expectedUnitPriceCents: number }>();
  for (const line of lines) {
    const existing = bySku.get(line.sku);
    bySku.set(line.sku, {
      qty: (existing?.qty ?? 0) + line.qty,
      // Duplicate lines: the stricter (lower) expectation wins, so any stale display fails.
      expectedUnitPriceCents: Math.min(
        existing?.expectedUnitPriceCents ?? line.expectedUnitPriceCents,
        line.expectedUnitPriceCents,
      ),
    });
  }
  return bySku;
}

async function resolveLines(
  bySku: Map<string, { qty: number; expectedUnitPriceCents: number }>,
  session: ClientSession,
): Promise<ResolvedLine[]> {
  const skus = [...bySku.keys()];
  type LeanVariantSource = Pick<Product, "name" | "variants" | "priceCents"> & {
    _id: mongoose.Types.ObjectId;
  };
  const products = await ProductModel.find({ "variants.sku": { $in: skus } })
    .select("_id name priceCents variants")
    .session(session)
    .lean<LeanVariantSource[]>();
  const byVariant = new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [variant.sku, { product, variant }] as const),
    ),
  );
  const resolved: ResolvedLine[] = [];
  for (const [sku, entry2] of bySku) {
    const found = byVariant.get(sku);
    if (!found) throw new InsufficientStockError(sku);
    const { product, variant } = found;
    resolved.push({
      productId: product._id,
      sku,
      qty: entry2.qty,
      name: product.name,
      variantLabel: variant.label,
      unitPriceCents: product.priceCents + variant.priceDeltaCents,
      expectedUnitPriceCents: entry2.expectedUnitPriceCents,
      weightGrams: variant.weightGrams,
    });
  }
  return resolved;
}

async function decrementStock(lines: ResolvedLine[], session: ClientSession): Promise<void> {
  for (const line of lines) {
    const updated = await ProductModel.findOneAndUpdate(
      {
        _id: line.productId,
        variants: { $elemMatch: { sku: line.sku, stock: { $gte: line.qty } } },
      },
      { $inc: { "variants.$[v].stock": -line.qty } },
      { arrayFilters: [{ "v.sku": line.sku }], session, returnDocument: "after" },
    ).lean();
    if (!updated) throw new InsufficientStockError(line.sku);
  }
}

// Invoice orders need a registered account whose credit still covers the order
// (issue #40) — evaluated inside the transaction against the real totals.
async function assertInvoiceEligible(
  userId: string | undefined,
  totalCents: number,
  session: ClientSession,
): Promise<void> {
  if (!userId) throw new InvoiceNotEligibleError("no_account");
  const user = await UserModel.findById(userId).select("creditLimitCents").session(session).lean().exec();
  if (!user) throw new InvoiceNotEligibleError("no_account");
  const limit = user.creditLimitCents ?? DEFAULT_CREDIT_LIMIT_CENTS;
  const used = await getInvoiceCreditUsageCents(userId, session);
  if (used + totalCents > limit) throw new InvoiceNotEligibleError("credit_exceeded");
}

async function runCheckout(
  bySku: Map<string, { qty: number; expectedUnitPriceCents: number }>,
  customer: OrderCustomer,
  shippingMethod: ShippingMethodName,
  paymentMethod: PaymentMethodName,
  userId: string | undefined,
  session: ClientSession,
): Promise<{ orderNumber: string; totals: Totals }> {
  const lines = await resolveLines(bySku, session);

  const changed = lines
    .filter((line) => line.unitPriceCents !== line.expectedUnitPriceCents)
    .map((line) => ({ sku: line.sku, unitPriceCents: line.unitPriceCents }));
  if (changed.length > 0) throw new PriceChangedError(changed);

  await decrementStock(lines, session);

  const minted = await mintNumber("order", formatOrderNumber, session);
  const orderNumber = minted.value;

  const orderLines: OrderLine[] = lines.map((line) => ({
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    variantLabel: line.variantLabel,
    qty: line.qty,
    unitPriceCents: line.unitPriceCents,
    totalCents: line.unitPriceCents * line.qty,
    weightGrams: line.weightGrams,
  }));
  const totals = computeTotals(orderLines, shippingMethod);

  const now = new Date();
  const statusLog: StatusLogEntry[] = [{ status: "new", at: now }];

  let status: OrderStatus = "new";
  let log = statusLog;
  let payment: Order["payment"];
  if (paymentMethod === "invoice") {
    await assertInvoiceEligible(userId, totals.totalCents, session);
    payment = {
      method: "invoice" as const,
      reference: formatPaymentReference(minted.seq),
      invoice: {
        dueAt: invoiceDueAt(now),
        paidCents: 0,
        qrReference: qrReferenceForOrder(minted.year, minted.seq),
      },
    };
  } else {
    const paid = transition({ status: "new" as OrderStatus, statusLog }, "paid", {
      note: "Mock-Zahlung bestätigt",
      at: now,
    });
    status = paid.status;
    log = paid.statusLog;
    payment = {
      method: "mock" as const,
      reference: formatPaymentReference(minted.seq),
      paidAt: now,
    };
  }

  await OrderModel.create(
    [
      {
        orderNumber,
        status,
        statusLog: log,
        ...(userId !== undefined && { userId }),
        customer,
        lines: orderLines,
        totals,
        shipping: { method: shippingMethod },
        payment,
      },
    ],
    { session },
  );

  return { orderNumber, totals };
}

type MergedLines = Map<string, { qty: number; expectedUnitPriceCents: number }>;

// Issue #15: identical checkout submissions (double click, second tab, retry after a lost
// response) share a fingerprint; the unique claim on it makes "at most one order" hold
// server-side, not just via the disabled button.
function checkoutFingerprint(
  bySku: MergedLines,
  customer: OrderCustomer,
  shippingMethod: ShippingMethodName,
  paymentMethod: PaymentMethodName,
  userId: string | undefined,
): string {
  const canonical = JSON.stringify({
    customer,
    shippingMethod,
    paymentMethod,
    // Issue #39: the same cart from a guest and from a logged-in customer are different
    // submissions — they must not share an idempotency claim.
    ...(userId !== undefined && { userId }),
    lines: [...bySku.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sku, entry]) => `${sku}:${entry.qty}`),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 11000;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Waits for the winning submission to record its order; null once the claim is gone
// (the winner failed and released it, so this call may claim and run itself).
async function resolveExistingClaim(key: string): Promise<CreateOrderResult | null> {
  for (let poll = 0; poll < 40; poll++) {
    const claim = await CheckoutClaimModel.findById(key).lean().exec();
    if (!claim) return null;
    if (claim.orderNumber) {
      const order = await OrderModel.findOne({ orderNumber: claim.orderNumber })
        .select("orderNumber totals")
        .lean()
        .exec();
      if (order) return { ok: true, orderNumber: order.orderNumber, totals: order.totals };
    }
    await sleep(250);
  }
  return {
    ok: false,
    error: "Diese Bestellung wird bereits verarbeitet. Bitte prüfen Sie Ihre Bestellungen.",
  };
}

async function runClaimedCheckout(
  key: string,
  bySku: MergedLines,
  customer: OrderCustomer,
  shippingMethod: ShippingMethodName,
  paymentMethod: PaymentMethodName,
  userId: string | undefined,
): Promise<CreateOrderResult> {
  const release = () => CheckoutClaimModel.deleteOne({ _id: key }).catch(() => {});

  // Concurrent checkouts serialize on the counter document; the loser of a write conflict
  // must back off (issue #11) — immediate retries just collide again.
  const maxAttempts = 6;
  for (let attempt = 1; ; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await runCheckout(
        bySku,
        customer,
        shippingMethod,
        paymentMethod,
        userId,
        session,
      );
      await session.commitTransaction();
      await CheckoutClaimModel.updateOne({ _id: key }, { $set: { orderNumber: result.orderNumber } });
      return { ok: true, ...result };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      await release();
      if (error instanceof InsufficientStockError) {
        return {
          ok: false,
          error: `Nicht genügend Lager für ${error.sku}. Bitte Menge reduzieren.`,
        };
      }
      if (error instanceof PriceChangedError) {
        return {
          ok: false,
          reason: "price_changed",
          changed: error.changed,
          error: "Ein Preis hat sich geändert. Bitte prüfen Sie die neue Summe und bestätigen Sie erneut.",
        };
      }
      if (error instanceof InvoiceNotEligibleError) {
        return {
          ok: false,
          error:
            error.reason === "no_account"
              ? "Rechnung ist nur für registrierte Kunden möglich. Bitte anmelden oder eine andere Zahlungsart wählen."
              : "Das Kreditlimit für Rechnungszahlung ist erreicht. Bitte eine andere Zahlungsart wählen.",
        };
      }
      if (isTransientError(error) && attempt < maxAttempts) {
        await sleep(Math.min(10 * 2 ** (attempt - 1), 320) + Math.random() * 10);
        continue;
      }
      return {
        ok: false,
        error: "Bestellung konnte nicht erstellt werden. Bitte erneut versuchen.",
      };
    } finally {
      session.endSession();
    }
  }
}

export async function createOrderCore(
  input: unknown,
  opts: { userId?: string } = {},
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben" };
  }
  const { lines, customer, shippingMethod, paymentMethod } = parsed.data;

  await connectDB();
  const bySku = mergeLines(lines);
  const key = checkoutFingerprint(bySku, customer, shippingMethod, paymentMethod, opts.userId);

  // Two rounds: if a duplicate claim vanishes while we wait (its owner failed), we claim
  // once more ourselves instead of erroring out.
  for (let round = 0; round < 2; round++) {
    try {
      await CheckoutClaimModel.create({ _id: key });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        return { ok: false, error: "Bestellung konnte nicht erstellt werden. Bitte erneut versuchen." };
      }
      const existing = await resolveExistingClaim(key);
      if (existing) return existing;
      continue;
    }
    return runClaimedCheckout(key, bySku, customer, shippingMethod, paymentMethod, opts.userId);
  }
  return {
    ok: false,
    error: "Diese Bestellung wird bereits verarbeitet. Bitte prüfen Sie Ihre Bestellungen.",
  };
}
