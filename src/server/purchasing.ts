import mongoose from "mongoose";
import {
  createPurchaseOrderSchema,
  supplierInputSchema,
  type SupplierInput,
} from "@/lib/validations/purchasing";
import { formatPoNumber } from "@/lib/numbers";
import { escapeRegex } from "@/lib/regex";
import { ProductModel } from "@/models/product";
import {
  PurchaseOrderModel,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/models/purchase-order";
import { SupplierModel, type Supplier } from "@/models/supplier";
import { mintNumber } from "./numbers";
import { connectDB } from "./db";

export type PurchasingResult = { ok: true } | { ok: false; error: string };

// ---------- suppliers ----------

export async function listSuppliers(): Promise<Supplier[]> {
  await connectDB();
  return SupplierModel.find().sort({ name: 1 }).lean<Supplier[]>().exec();
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  return SupplierModel.findById(id).lean<Supplier>().exec();
}

function duplicateSupplierName(error: unknown): boolean {
  const e = error as { code?: number };
  return e?.code === 11000;
}

export async function createSupplierCore(input: unknown): Promise<PurchasingResult> {
  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  try {
    await SupplierModel.create(parsed.data);
  } catch (error) {
    if (duplicateSupplierName(error)) {
      return { ok: false, error: "Ein Lieferant mit diesem Namen existiert bereits." };
    }
    throw error;
  }
  return { ok: true };
}

export async function updateSupplierCore(
  supplierId: string,
  input: unknown,
): Promise<PurchasingResult> {
  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  if (!mongoose.isValidObjectId(supplierId)) {
    return { ok: false, error: "Lieferant nicht gefunden." };
  }
  try {
    const updated = await SupplierModel.findByIdAndUpdate(supplierId, parsed.data, {
      returnDocument: "after",
    }).exec();
    if (!updated) return { ok: false, error: "Lieferant nicht gefunden." };
  } catch (error) {
    if (duplicateSupplierName(error)) {
      return { ok: false, error: "Ein Lieferant mit diesem Namen existiert bereits." };
    }
    throw error;
  }
  return { ok: true };
}

export function toSupplierInput(formData: FormData): SupplierInput | null {
  const parsed = supplierInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    leadTimeDays: formData.get("leadTimeDays"),
    active: formData.get("active") === "on",
  });
  return parsed.success ? parsed.data : null;
}

// ---------- purchase orders ----------

export interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  supplierName: string;
  totalCents: number;
  lineCount: number;
  createdAt: Date;
  orderedAt?: Date;
  receivedAt?: Date;
}

export const PO_LIST_LIMIT = 200;

export async function listPurchaseOrders(): Promise<PurchaseOrderListItem[]> {
  await connectDB();
  const [pos, suppliers] = await Promise.all([
    PurchaseOrderModel.find().sort({ createdAt: -1 }).limit(PO_LIST_LIMIT).lean<PurchaseOrder[]>().exec(),
    SupplierModel.find().lean<Supplier[]>().exec(),
  ]);
  const names = new Map(suppliers.map((supplier) => [supplier._id.toString(), supplier.name]));
  return pos.map((po) => ({
    id: po._id.toString(),
    poNumber: po.poNumber,
    status: po.status,
    supplierName: names.get(po.supplierId.toString()) ?? "Unbekannt",
    totalCents: po.totalCents,
    lineCount: po.lines.length,
    createdAt: po.createdAt,
    orderedAt: po.orderedAt,
    receivedAt: po.receivedAt,
  }));
}

export interface PurchaseOrderDetail {
  po: PurchaseOrder;
  supplier: Supplier | null;
  productNames: Map<string, string>;
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrderDetail | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  const po = await PurchaseOrderModel.findById(id).lean<PurchaseOrder>().exec();
  if (!po) return null;
  const [supplier, products] = await Promise.all([
    SupplierModel.findById(po.supplierId).lean<Supplier>().exec(),
    ProductModel.find({ _id: { $in: po.lines.map((line) => line.productId) } })
      .select("_id name")
      .lean<{ _id: mongoose.Types.ObjectId; name: string }[]>()
      .exec(),
  ]);
  return {
    po,
    supplier,
    productNames: new Map(products.map((product) => [product._id.toString(), product.name])),
  };
}

export async function createPurchaseOrderCore(input: unknown): Promise<
  { ok: true; poId: string; poNumber: string } | { ok: false; error: string }
> {
  const parsed = createPurchaseOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const { supplierId, lines } = parsed.data;

  await connectDB();
  if (!mongoose.isValidObjectId(supplierId)) {
    return { ok: false, error: "Lieferant nicht gefunden." };
  }
  const supplier = await SupplierModel.findById(supplierId).exec();
  if (!supplier) return { ok: false, error: "Lieferant nicht gefunden." };

  const skus = lines.map((line) => line.sku);
  type LeanProduct = { _id: mongoose.Types.ObjectId; variants: { sku: string }[] };
  const products = await ProductModel.find({ "variants.sku": { $in: skus } })
    .select("_id variants.sku")
    .lean<LeanProduct[]>()
    .exec();
  const productIds = new Map<string, mongoose.Types.ObjectId>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (skus.includes(variant.sku)) productIds.set(variant.sku, product._id);
    }
  }
  const unknown = skus.find((sku) => !productIds.has(sku));
  if (unknown) return { ok: false, error: `Unbekannte SKU: ${unknown}` };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { value: poNumber } = await mintNumber("po", formatPoNumber, session);
    const [created] = await PurchaseOrderModel.create(
      [
        {
          poNumber,
          supplierId,
          status: "draft" as PurchaseOrderStatus,
          lines: lines.map((line) => ({
            productId: productIds.get(line.sku)!,
            sku: line.sku,
            qty: line.qty,
            unitPriceCents: line.unitPriceCents,
            received: 0,
          })),
          totalCents: lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0),
        },
      ],
      { session },
    );
    await session.commitTransaction();
    return { ok: true, poId: created._id.toString(), poNumber };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function markPurchaseOrderOrderedCore(poId: string): Promise<PurchasingResult> {
  await connectDB();
  if (!mongoose.isValidObjectId(poId)) return { ok: false, error: "Bestellung nicht gefunden." };
  const updated = await PurchaseOrderModel.findOneAndUpdate(
    { _id: poId, status: "draft" },
    { $set: { status: "ordered", orderedAt: new Date() } },
    { returnDocument: "after" },
  ).exec();
  if (!updated) return { ok: false, error: "Nur Entwürfe können bestellt werden." };
  return { ok: true };
}

export interface ReceiveResult {
  ok: true;
  restocked: { sku: string; qty: number }[];
}

export async function receivePurchaseOrderCore(
  poId: string,
): Promise<ReceiveResult | { ok: false; error: string }> {
  await connectDB();
  if (!mongoose.isValidObjectId(poId)) return { ok: false, error: "Bestellung nicht gefunden." };

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const po = await PurchaseOrderModel.findById(poId).session(session).exec();
    if (!po) {
      await session.abortTransaction();
      return { ok: false, error: "Bestellung nicht gefunden." };
    }
    if (po.status !== "ordered") {
      await session.abortTransaction();
      return { ok: false, error: "Wareneingang ist nur für bestellte Bestellungen möglich." };
    }

    const restocked: { sku: string; qty: number }[] = [];
    for (const line of po.lines) {
      const delta = line.qty - line.received;
      if (delta <= 0) continue;
      const updated = await ProductModel.findOneAndUpdate(
        { _id: line.productId, "variants.sku": line.sku },
        { $inc: { "variants.$[v].stock": delta } },
        { arrayFilters: [{ "v.sku": line.sku }], session, returnDocument: "after" },
      ).lean();
      if (!updated) {
        await session.abortTransaction();
        return { ok: false, error: `Produkt für SKU ${line.sku} nicht gefunden.` };
      }
      line.received = line.qty;
      restocked.push({ sku: line.sku, qty: delta });
    }

    po.markModified("lines");
    po.status = "received";
    po.receivedAt = new Date();
    await po.save({ session });
    await session.commitTransaction();
    return { ok: true, restocked };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// ---------- variant search for the PO picker (issue #42) ----------

export interface SkuSearchHit {
  sku: string;
  productName: string;
  variantLabel: string;
  stock: number;
  priceCents: number;
  imageSrc?: string;
  lastPurchasePriceCents?: number;
}

// The picker searches what the buyer actually knows: SKU, product name or brand.
export async function searchVariantsBySku(query: string): Promise<SkuSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  await connectDB();
  const regex = { $regex: escapeRegex(trimmed), $options: "i" };
  type LeanProduct = {
    _id: mongoose.Types.ObjectId;
    name: string;
    brand: string;
    priceCents: number;
    images: { src: string }[];
    variants: { sku: string; label: string; stock: number; priceDeltaCents: number }[];
  };
  const bySkuOrName = await ProductModel.find({
    $or: [{ "variants.sku": regex }, { name: regex }, { brand: regex }],
  })
    .select(
      "name brand priceCents images.src variants.sku variants.label variants.stock variants.priceDeltaCents",
    )
    .limit(20)
    .lean<LeanProduct[]>()
    .exec();

  // A pure name/brand match brings the whole product — but when some variant's SKU
  // matches the query too, those are what the buyer typed for and only they are shown.
  const lower = trimmed.toLowerCase();
  const all = bySkuOrName.flatMap((product) =>
    product.variants.map((variant) => ({
      sku: variant.sku,
      productName: product.name,
      variantLabel: variant.label,
      stock: variant.stock,
      priceCents: product.priceCents + variant.priceDeltaCents,
      imageSrc: product.images[0]?.src,
      skuMatch: variant.sku.toLowerCase().includes(lower),
    })),
  );
  const skuMatches = all.filter((hit) => hit.skuMatch);
  const ranked = (skuMatches.length > 0 ? skuMatches : all).slice(0, 10);
  const matched: SkuSearchHit[] = ranked.map((hit) => ({
    sku: hit.sku,
    productName: hit.productName,
    variantLabel: hit.variantLabel,
    stock: hit.stock,
    priceCents: hit.priceCents,
    ...(hit.imageSrc !== undefined && { imageSrc: hit.imageSrc }),
  }));

  // Last purchase price per SKU (issue #42): the newest PO line that mentions it.
  const skus = matched.map((hit) => hit.sku);
  if (skus.length > 0) {
    const pos = await PurchaseOrderModel.find({ "lines.sku": { $in: skus } })
      .select("lines.sku lines.unitPriceCents")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
    const lastPrice = new Map<string, number>();
    for (const po of pos) {
      for (const line of po.lines) {
        if (!lastPrice.has(line.sku)) lastPrice.set(line.sku, line.unitPriceCents);
      }
    }
    for (const hit of matched) {
      const price = lastPrice.get(hit.sku);
      if (price !== undefined) hit.lastPurchasePriceCents = price;
    }
  }
  return matched;
}

// ---------- supplier search for the PO picker (issue #42) ----------

export interface SupplierSearchHit {
  id: string;
  name: string;
  leadTimeDays: number;
  openPos: number;
}

export async function searchSuppliers(query: string): Promise<SupplierSearchHit[]> {
  await connectDB();
  const trimmed = query.trim();
  const filter: Record<string, unknown> = { active: true };
  if (trimmed) filter.name = { $regex: escapeRegex(trimmed), $options: "i" };
  const suppliers = await SupplierModel.find(filter)
    .select("name leadTimeDays")
    .sort({ name: 1 })
    .limit(10)
    .lean()
    .exec();
  if (suppliers.length === 0) return [];
  const open = await PurchaseOrderModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>(
    [
      { $match: { supplierId: { $in: suppliers.map((s) => s._id) }, status: "ordered" } },
      { $group: { _id: "$supplierId", count: { $sum: 1 } } },
    ],
  ).then((rows) => new Map(rows.map((row) => [row._id.toString(), row.count])));
  return suppliers.map((supplier) => ({
    id: supplier._id.toString(),
    name: supplier.name,
    leadTimeDays: supplier.leadTimeDays,
    openPos: open.get(supplier._id.toString()) ?? 0,
  }));
}
