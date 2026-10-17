import mongoose, { type ClientSession } from "mongoose";
import { formatOrderNumber, formatPaymentReference } from "@/lib/numbers";
import { transition, type OrderStatus } from "@/lib/orders/state-machine";
import { computeTotals, type ShippingMethodName, type Totals } from "@/lib/pricing";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { OrderModel, type OrderCustomer, type OrderLine, type StatusLogEntry } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { connectDB } from "./db";
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

async function runCheckout(
  bySku: Map<string, { qty: number; expectedUnitPriceCents: number }>,
  customer: OrderCustomer,
  shippingMethod: ShippingMethodName,
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
  const paid = transition({ status: "new" as OrderStatus, statusLog }, "paid", {
    note: "Mock-Zahlung bestätigt",
    at: now,
  });

  await OrderModel.create(
    [
      {
        orderNumber,
        status: paid.status,
        statusLog: paid.statusLog,
        customer,
        lines: orderLines,
        totals,
        shipping: { method: shippingMethod },
        payment: {
          method: "mock" as const,
          reference: formatPaymentReference(minted.seq),
          paidAt: now,
        },
      },
    ],
    { session },
  );

  return { orderNumber, totals };
}

export async function createOrderCore(
  input: unknown,
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben" };
  }
  const { lines, customer, shippingMethod } = parsed.data;

  await connectDB();
  const bySku = mergeLines(lines);

  // Concurrent checkouts serialize on the counter document; the loser of a write conflict
  // must back off (issue #11) — immediate retries just collide again.
  const maxAttempts = 6;
  for (let attempt = 1; ; attempt++) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await runCheckout(bySku, customer, shippingMethod, session);
      await session.commitTransaction();
      return { ok: true, ...result };
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
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
      if (isTransientError(error) && attempt < maxAttempts) {
        const backoffMs = Math.min(10 * 2 ** (attempt - 1), 320) + Math.random() * 10;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
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
