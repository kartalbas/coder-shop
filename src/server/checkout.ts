import { createHash } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { interpolate, label } from "@/lib/i18n";
import { DEFAULT_CREDIT_LIMIT_CENTS, invoiceDueAt, qrReferenceForOrder } from "@/lib/invoices";
import { formatOrderNumber, formatPaymentReference } from "@/lib/numbers";
import { transition, type OrderStatus } from "@/lib/orders/state-machine";
import { computeTotals, subtotalCents, type Totals } from "@/lib/pricing";
import type {
  PaymentMethodConfig,
  ShippingMethodConfig,
  ShopSettings,
} from "@/lib/shop-settings";
import { activePaymentMethods, activeShippingMethods } from "@/lib/shop-settings";
import { createCheckoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
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
import { absoluteUrl } from "@/lib/site";
import { invoiceMail, orderConfirmationMail } from "@/lib/mail-templates";
import { connectDB } from "./db";
import { NotEnoughUnitsError, reserveUnitsForOrder, serialTrackedTypes } from "./stock-units";
import { getShopSettings } from "./shop-settings";
import {
  checkDiscountCore,
  DiscountRejectedError,
  normalizeDiscountCode,
  redeemDiscount,
} from "./discounts";
import { getRequestLabels } from "./i18n";
import { getInvoiceCreditUsageCents } from "./invoices";
import { sendMail } from "./mail";
import { mintNumber } from "./numbers";
import { generatePickupCode } from "./pickup";

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
  type: string;
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
  type LeanVariantSource = Pick<Product, "name" | "variants" | "priceCents" | "type"> & {
    _id: mongoose.Types.ObjectId;
  };
  const products = await ProductModel.find({ "variants.sku": { $in: skus } })
    .select("_id name priceCents type variants")
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
      type: product.type,
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
  shipping: ShippingMethodConfig,
  payment: PaymentMethodConfig,
  settings: ShopSettings,
  userId: string | undefined,
  discountCode: string | undefined,
  session: ClientSession,
): Promise<{ orderNumber: string; totals: Totals; invoiceDueAt?: Date }> {
  const lines = await resolveLines(bySku, session);

  const changed = lines
    .filter((line) => line.unitPriceCents !== line.expectedUnitPriceCents)
    .map((line) => ({ sku: line.sku, unitPriceCents: line.unitPriceCents }));
  if (changed.length > 0) throw new PriceChangedError(changed);

  // Issue #45: the code is checked against the database subtotal before anything moves;
  // the redemption itself is booked below, once the order number exists.
  const customerKey = (userId ?? customer.email).toLowerCase();
  let discount: { code: string; cents: number } | undefined;
  let discountDoc: Awaited<ReturnType<typeof checkDiscountCore>>["doc"];
  if (discountCode) {
    const check = await checkDiscountCore(
      discountCode,
      subtotalCents(lines.map((line) => ({ unitPriceCents: line.unitPriceCents, qty: line.qty }))),
      customerKey,
      new Date(),
      session,
    );
    if (!check.ok || !check.doc) throw new DiscountRejectedError(check.error ?? "Ungültiger Code.");
    discount = { code: check.doc.code, cents: check.discountCents ?? 0 };
    discountDoc = check.doc;
  }

  await decrementStock(lines, session);

  const minted = await mintNumber("order", formatOrderNumber, session);
  const orderNumber = minted.value;

  // Issue #62 (#54): serial-tracked types move specific units with the order — the
  // reservation happens in this transaction, so stock count and unit ledger can
  // never disagree. Quantity-tracked lines have no units.
  const serialTypes = await serialTrackedTypes();
  const serialLines = lines.filter((line) => serialTypes.has(line.type));
  const serialsBySku =
    serialLines.length > 0
      ? await reserveUnitsForOrder(
          serialLines.map((line) => ({ sku: line.sku, qty: line.qty })),
          orderNumber,
          session,
        )
      : new Map<string, string[]>();

  // Book the redemption now that the order number exists — a later abort of this
  // transaction rolls the counter and the usage document back as well.
  if (discount && discountDoc) {
    await redeemDiscount(discountDoc, customerKey, orderNumber, session);
  }

  const orderLines: OrderLine[] = lines.map((line) => {
    const serials = serialsBySku.get(line.sku);
    return {
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      variantLabel: line.variantLabel,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.unitPriceCents * line.qty,
      weightGrams: line.weightGrams,
      ...(serials !== undefined && { serials }),
    };
  });
  const totals = computeTotals(orderLines, shipping.key, settings, discount?.cents ?? 0);

  const now = new Date();
  const statusLog: StatusLogEntry[] = [{ status: "new", at: now }];

  let status: OrderStatus = "new";
  let log = statusLog;
  let orderPayment: Order["payment"];
  let dueAt: Date | undefined;
  // Issue #64: the money flow follows the configured *kind*, not the method key —
  // any "immediate" method books paid at once, any "invoice" method stays open
  // against the account's credit, any "on_pickup" method is paid at the counter.
  if (payment.kind === "invoice") {
    await assertInvoiceEligible(userId, totals.totalCents, session);
    dueAt = invoiceDueAt(now);
    orderPayment = {
      method: payment.key,
      kind: "invoice",
      reference: formatPaymentReference(minted.seq),
      invoice: {
        dueAt,
        paidCents: 0,
        qrReference: qrReferenceForOrder(minted.year, minted.seq),
      },
    };
  } else if (payment.kind === "on_pickup") {
    // Pay at the counter (issue #41): the order stays unpaid until the handover.
    orderPayment = {
      method: payment.key,
      kind: "on_pickup",
      reference: formatPaymentReference(minted.seq),
    };
  } else {
    const paid = transition({ status: "new" as OrderStatus, statusLog }, "paid", {
      note: "Zahlung bestätigt",
      at: now,
    });
    status = paid.status;
    log = paid.statusLog;
    orderPayment = {
      method: payment.key,
      kind: "immediate",
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
        ...(discount !== undefined && { discount }),
        shipping: {
          method: shipping.key,
          storePickup: shipping.storePickup,
          // #62 review: the carrier service level rides along as a stored behavior flag.
          expressService: shipping.expressService,
          // Pickup orders carry the handover code from the start (issue #41).
          ...(shipping.storePickup && { pickup: { code: generatePickupCode() } }),
        },
        payment: orderPayment,
      },
    ],
    { session },
  );

  return { orderNumber, totals, ...(dueAt !== undefined && { invoiceDueAt: dueAt }) };
}

type MergedLines = Map<string, { qty: number; expectedUnitPriceCents: number }>;

// Issue #44: the confirmation (and the invoice for Rechnung orders) is sent after the
// commit — a mail must never announce an order that was not written. Failures are logged
// only: the order exists, the customer sees it in the portal, and a failed mail must not
// turn a successful checkout into an error.
async function sendCheckoutMails(
  customer: OrderCustomer,
  payment: PaymentMethodConfig,
  result: { orderNumber: string; totals: Totals; invoiceDueAt?: Date },
): Promise<void> {
  const { orderNumber, totals } = result;
  const link = absoluteUrl(`/orders/${orderNumber}`);
  try {
    await sendMail({
      to: customer.email,
      ...orderConfirmationMail({
        name: customer.name,
        orderNumber,
        totalCents: totals.totalCents,
        link,
      }),
    });
    if (payment.kind === "invoice" && result.invoiceDueAt) {
      await sendMail({
        to: customer.email,
        ...invoiceMail({
          name: customer.name,
          orderNumber,
          totalCents: totals.totalCents,
          dueDate: result.invoiceDueAt.toLocaleDateString("de-CH"),
          pdfLink: absoluteUrl(`/orders/${orderNumber}/invoice`),
        }),
      });
    }
  } catch (error) {
    console.error(`Bestellung ${orderNumber}: Bestätigungs-Mail fehlgeschlagen`, error);
  }
}

// Issue #15: identical checkout submissions (double click, second tab, retry after a lost
// response) share a fingerprint; the unique claim on it makes "at most one order" hold
// server-side, not just via the disabled button.
function checkoutFingerprint(
  bySku: MergedLines,
  customer: OrderCustomer,
  shippingMethod: string,
  paymentMethod: string,
  userId: string | undefined,
  discountCode: string | undefined,
): string {
  const canonical = JSON.stringify({
    customer,
    shippingMethod,
    paymentMethod,
    // Issue #39: the same cart from a guest and from a logged-in customer are different
    // submissions — they must not share an idempotency claim.
    ...(userId !== undefined && { userId }),
    // Issue #45: with and without a code are different submissions too.
    ...(discountCode !== undefined && { discountCode }),
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
async function resolveExistingClaim(
  key: string,
  labels: Readonly<Record<string, string>>,
): Promise<CreateOrderResult | null> {
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
    error: label(labels, "shop.checkout.error.inFlight"),
  };
}

async function runClaimedCheckout(
  key: string,
  bySku: MergedLines,
  customer: OrderCustomer,
  shipping: ShippingMethodConfig,
  payment: PaymentMethodConfig,
  settings: ShopSettings,
  userId: string | undefined,
  discountCode: string | undefined,
  labels: Readonly<Record<string, string>>,
): Promise<CreateOrderResult> {
  const release = () => CheckoutClaimModel.deleteOne({ _id: key }).catch(() => {});

  // Concurrent checkouts serialize on the counter document; the loser of a write conflict
  // must back off (issue #11) — immediate retries just collide again. With n parallel
  // checkouts a single one can lose up to n−1 conflict rounds, so the budget must cover
  // more than any realistic concurrency (6 was flaky at 10 parallel under load).
  const maxAttempts = 16;
  for (let attempt = 1; ; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await runCheckout(
        bySku,
        customer,
        shipping,
        payment,
        settings,
        userId,
        discountCode,
        session,
      );
      await session.commitTransaction();
      await CheckoutClaimModel.updateOne({ _id: key }, { $set: { orderNumber: result.orderNumber } });
      await sendCheckoutMails(customer, payment, result);
      return { ok: true, ...result };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      await release();
      if (error instanceof InsufficientStockError || error instanceof NotEnoughUnitsError) {
        return {
          ok: false,
          error: interpolate(label(labels, "shop.checkout.error.outOfStock"), {
            sku: error.sku,
          }),
        };
      }
      if (error instanceof PriceChangedError) {
        return {
          ok: false,
          reason: "price_changed",
          changed: error.changed,
          error: label(labels, "shop.checkout.error.priceChanged"),
        };
      }
      if (error instanceof InvoiceNotEligibleError) {
        return {
          ok: false,
          error:
            error.reason === "no_account"
              ? label(labels, "shop.checkout.error.invoiceGuestOnly")
              : label(labels, "shop.checkout.error.invoiceCreditExhausted"),
        };
      }
      // Issue #45: a rejected code is a clean user error, not a retryable failure.
      if (error instanceof DiscountRejectedError) {
        return { ok: false, error: error.message };
      }
      if (isTransientError(error) && attempt < maxAttempts) {
        await sleep(Math.min(10 * 2 ** (attempt - 1), 200) + Math.random() * 20);
        continue;
      }
      return {
        ok: false,
        error: label(labels, "shop.checkout.error.failed"),
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
  // #58: the payload is validated with the request language's messages (outside a
  // request scope — tests, scripts — the first active language answers), and every
  // refusal below resolves through the same label map.
  const labels = await getRequestLabels();
  const parsed = createCheckoutSchema(labels).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm") };
  }
  const { lines, customer, shippingMethod, paymentMethod, discountCode } = parsed.data;
  const normalizedCode = discountCode ? normalizeDiscountCode(discountCode) : undefined;

  await connectDB();
  // Issue #64: the chosen methods must exist in the current configuration and fit
  // together — „on_pickup" payment only with store pickup, invoice-type payment only
  // with a delivered parcel (the rules #41 established, now read from the rows).
  const settings = await getShopSettings();
  const shipping = activeShippingMethods(settings).find((method) => method.key === shippingMethod);
  if (!shipping) {
    return { ok: false, error: label(labels, "shop.checkout.error.shippingGone") };
  }
  const payment = activePaymentMethods(settings).find((method) => method.key === paymentMethod);
  if (!payment) {
    return { ok: false, error: label(labels, "shop.checkout.error.paymentGone") };
  }
  if (payment.kind === "on_pickup" && !shipping.storePickup) {
    return { ok: false, error: label(labels, "shop.checkout.error.payAtPickupNeedsPickup") };
  }
  if (payment.kind === "invoice" && shipping.storePickup) {
    return { ok: false, error: label(labels, "shop.checkout.error.invoiceNeedsDelivery") };
  }

  const bySku = mergeLines(lines);
  const key = checkoutFingerprint(
    bySku,
    customer,
    shipping.key,
    payment.key,
    opts.userId,
    normalizedCode,
  );

  // Two rounds: if a duplicate claim vanishes while we wait (its owner failed), we claim
  // once more ourselves instead of erroring out.
  for (let round = 0; round < 2; round++) {
    try {
      await CheckoutClaimModel.create({ _id: key });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        return { ok: false, error: label(labels, "shop.checkout.error.failed") };
      }
      const existing = await resolveExistingClaim(key, labels);
      if (existing) return existing;
      continue;
    }
    return runClaimedCheckout(
      key,
      bySku,
      customer,
      shipping,
      payment,
      settings,
      opts.userId,
      normalizedCode,
      labels,
    );
  }
  return {
    ok: false,
    error: label(labels, "shop.checkout.error.inFlight"),
  };
}
