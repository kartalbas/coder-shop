import { swissYear } from "@/lib/dates";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CounterModel } from "@/models/counter";
import { ProductModel, type Product } from "@/models/product";
import { PurchaseOrderModel, type PurchaseOrder } from "@/models/purchase-order";
import { SupplierModel } from "@/models/supplier";
import {
  createPurchaseOrderCore,
  createSupplierCore,
  markPurchaseOrderOrderedCore,
  receivePurchaseOrderCore,
  searchSuppliers,
  searchVariantsBySku,
  updateSupplierCore,
} from "@/server/purchasing";
import { formatPoNumber } from "@/lib/numbers";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

async function seedProduct(tag: string, skus: string[], stock: number) {
  return ProductModel.create({
    slug: `purchasing-${tag}`,
    name: `Purchasing Produkt ${tag}`,
    description: "Produkt für Einkaufs-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 50000,
    images: [{ src: `/products/purchasing-${tag}-1.svg`, alt: "Test" }],
    featured: false,
    filter: {  color: ["schwarz"], size: [], storage: ["128"], material: []  },
    variants: skus.map((sku) => ({
      sku,
      label: `128 GB / ${sku}`,
      priceDeltaCents: 0,
      stock,
      restockThreshold: 3,
      weightGrams: 200,
      attributes: { color: "schwarz", storage: 128 },
    })),
  });
}

async function seedSupplier(name: string) {
  return SupplierModel.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.ch`,
    leadTimeDays: 7,
    active: true,
  });
}

async function stockOf(sku: string): Promise<number> {
  const product = await ProductModel.findOne({ "variants.sku": sku }).lean<Product>().exec();
  return product?.variants.find((v) => v.sku === sku)?.stock ?? -1;
}

describe("supplier core", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  const supplierInput = {
    name: "Neuland Handels AG",
    email: "kontakt@neuland.ch",
    phone: "+41 44 000 00 00",
    leadTimeDays: 10,
    active: true,
  };

  it("creates a supplier and rejects a duplicate name", async () => {
    expect(await createSupplierCore(supplierInput)).toEqual({ ok: true });
    expect(await SupplierModel.countDocuments({ name: supplierInput.name })).toBe(1);

    const duplicate = await createSupplierCore({ ...supplierInput, email: "andere@neuland.ch" });
    expect(duplicate).toEqual({
      ok: false,
      error: "Ein Lieferant mit diesem Namen existiert bereits.",
    });
  });

  it("rejects invalid input", async () => {
    const result = await createSupplierCore({ ...supplierInput, name: "X", email: "keine" });
    expect(result.ok).toBe(false);
  });

  it("updates a supplier", async () => {
    const supplier = await SupplierModel.findOne({ name: supplierInput.name }).exec();
    expect(supplier).not.toBeNull();
    const result = await updateSupplierCore(supplier!._id.toString(), {
      ...supplierInput,
      leadTimeDays: 21,
      active: false,
    });
    expect(result).toEqual({ ok: true });

    const fresh = await SupplierModel.findById(supplier!._id).exec();
    expect(fresh?.leadTimeDays).toBe(21);
    expect(fresh?.active).toBe(false);
  });

  it("returns an error when updating an unknown supplier", async () => {
    const result = await updateSupplierCore("000000000000000000000000", supplierInput);
    expect(result).toEqual({ ok: false, error: "Lieferant nicht gefunden." });
  });
});

describe("purchase order core", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("creates a draft PO with a gap-free E-number and correct total", async () => {
    await seedProduct("create", ["PO-A1", "PO-A2"], 5);
    const supplier = await seedSupplier("Create Lieferant");

    const result = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [
        { sku: "PO-A1", qty: 7, unitPriceCents: 30000 },
        { sku: "PO-A2", qty: 3, unitPriceCents: 25000 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.poNumber).toMatch(/^E-\d{4}-\d{6}$/);
    expect(result.poNumber).toBe(formatPoNumber(swissYear(new Date()), 1));

    const po = await PurchaseOrderModel.findById(result.poId).lean<PurchaseOrder>().exec();
    expect(po?.status).toBe("draft");
    expect(po?.totalCents).toBe(7 * 30000 + 3 * 25000);
    expect(po?.lines.map((l) => [l.sku, l.qty, l.received])).toEqual([
      ["PO-A1", 7, 0],
      ["PO-A2", 3, 0],
    ]);

    const second = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [{ sku: "PO-A1", qty: 1, unitPriceCents: 100 }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.poNumber).toBe(formatPoNumber(swissYear(new Date()), 2));
  });

  it("rejects unknown skus, empty lines and unknown suppliers", async () => {
    const supplier = await SupplierModel.findOne({ name: "Create Lieferant" }).exec();
    const unknown = await createPurchaseOrderCore({
      supplierId: supplier!._id.toString(),
      lines: [{ sku: "PO-UNBEKANNT", qty: 1, unitPriceCents: 100 }],
    });
    expect(unknown).toEqual({ ok: false, error: "Unbekannte SKU: PO-UNBEKANNT" });

    const empty = await createPurchaseOrderCore({
      supplierId: supplier!._id.toString(),
      lines: [],
    });
    expect(empty.ok).toBe(false);

    const noSupplier = await createPurchaseOrderCore({
      supplierId: "000000000000000000000000",
      lines: [{ sku: "PO-A1", qty: 1, unitPriceCents: 100 }],
    });
    expect(noSupplier).toEqual({ ok: false, error: "Lieferant nicht gefunden." });
  });

  it("walks draft → ordered → received and increments variant stock exactly by the ordered qty", async () => {
    await seedProduct("receive", ["PO-B1", "PO-B2"], 4);
    const supplier = await seedSupplier("Receive Lieferant");
    const created = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [
        { sku: "PO-B1", qty: 6, unitPriceCents: 12345 },
        { sku: "PO-B2", qty: 11, unitPriceCents: 999 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // receiving a draft is rejected
    const tooEarly = await receivePurchaseOrderCore(created.poId);
    expect(tooEarly).toEqual({
      ok: false,
      error: "Wareneingang ist nur für bestellte Bestellungen möglich.",
    });
    expect(await stockOf("PO-B1")).toBe(4);

    expect(await markPurchaseOrderOrderedCore(created.poId)).toEqual({ ok: true });
    const ordered = await PurchaseOrderModel.findById(created.poId).lean<PurchaseOrder>().exec();
    expect(ordered?.status).toBe("ordered");
    expect(ordered?.orderedAt).toBeInstanceOf(Date);

    // ordering twice fails
    expect(await markPurchaseOrderOrderedCore(created.poId)).toEqual({
      ok: false,
      error: "Nur Entwürfe können bestellt werden.",
    });

    const received = await receivePurchaseOrderCore(created.poId);
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    expect(received.restocked).toEqual([
      { sku: "PO-B1", qty: 6 },
      { sku: "PO-B2", qty: 11 },
    ]);

    expect(await stockOf("PO-B1")).toBe(4 + 6);
    expect(await stockOf("PO-B2")).toBe(4 + 11);

    const po = await PurchaseOrderModel.findById(created.poId).lean<PurchaseOrder>().exec();
    expect(po?.status).toBe("received");
    expect(po?.receivedAt).toBeInstanceOf(Date);
    expect(po?.lines.every((line) => line.received === line.qty)).toBe(true);
  });

  it("rejects receiving the same PO twice (stock unchanged after second attempt)", async () => {
    const po = await PurchaseOrderModel.findOne({ status: "received" }).exec();
    expect(po).not.toBeNull();
    const before = await stockOf("PO-B1");

    const again = await receivePurchaseOrderCore(po!._id.toString());
    expect(again).toEqual({
      ok: false,
      error: "Wareneingang ist nur für bestellte Bestellungen möglich.",
    });
    expect(await stockOf("PO-B1")).toBe(before);
  });

  it("aborts the transaction when a line's product disappeared", async () => {
    await seedProduct("ghost", ["PO-C1", "PO-C2"], 2);
    const supplier = await seedSupplier("Ghost Lieferant");
    const created = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [
        { sku: "PO-C1", qty: 5, unitPriceCents: 1000 },
        { sku: "PO-C2", qty: 5, unitPriceCents: 1000 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await markPurchaseOrderOrderedCore(created.poId);

    await ProductModel.deleteOne({ slug: "purchasing-ghost" });
    const result = await receivePurchaseOrderCore(created.poId);
    expect(result.ok).toBe(false);

    const po = await PurchaseOrderModel.findById(created.poId).lean<PurchaseOrder>().exec();
    expect(po?.status).toBe("ordered");
    expect(po?.lines.every((line) => line.received === 0)).toBe(true);
  });

  it("mints PO numbers from the shared counter", async () => {
    const counter = await CounterModel.findById("po").lean();
    const count = await PurchaseOrderModel.countDocuments();
    expect(counter?.seq).toBeGreaterThanOrEqual(count);
  });
});

describe("searchVariantsBySku", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedProduct("search", ["SRCH-ONE", "SRCH-TWO"], 9);
  });

  afterAll(disconnectTestDB);

  it("finds variants by case-insensitive sku substring", async () => {
    const hits = await searchVariantsBySku("srch-");
    expect(hits.map((hit) => hit.sku).sort()).toEqual(["SRCH-ONE", "SRCH-TWO"]);
    expect(hits[0]).toMatchObject({ productName: "Purchasing Produkt search", stock: 9 });
    expect(hits[0]?.priceCents).toBe(50000);
  });

  it("returns nothing for short queries and non-matches", async () => {
    expect(await searchVariantsBySku("s")).toEqual([]);
    expect(await searchVariantsBySku("gibt-es-nicht")).toEqual([]);
  });
});

describe("picker search (issue #42)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("finds variants by SKU, product name and brand, with image and last purchase price", async () => {
    await seedProduct("picker", ["PICK-A", "PICK-B"], 4);
    await seedSupplier("Picker Lieferant");
    const supplier = await SupplierModel.findOne({ name: "Picker Lieferant" }).lean().exec();

    const byName = await searchVariantsBySku("Purchasing Produkt picker");
    expect(byName.map((hit) => hit.sku).sort()).toEqual(["PICK-A", "PICK-B"]);
    expect(byName[0]?.imageSrc).toBe("/products/purchasing-picker-1.svg");

    const byBrand = await searchVariantsBySku("testm");
    expect(byBrand.length).toBeGreaterThanOrEqual(2);

    const bySku = await searchVariantsBySku("PICK-A");
    expect(bySku.map((hit) => hit.sku)).toEqual(["PICK-A"]);

    // A PO over that SKU puts the last purchase price on the hit.
    const po = await createPurchaseOrderCore({
      supplierId: supplier!._id.toString(),
      lines: [{ sku: "PICK-A", qty: 5, unitPriceCents: 22_200 }],
    });
    expect(po.ok).toBe(true);
    const withPrice = await searchVariantsBySku("PICK-A");
    expect(withPrice[0]?.lastPurchasePriceCents).toBe(22_200);
    const withoutPrice = await searchVariantsBySku("PICK-B");
    expect(withoutPrice[0]?.lastPurchasePriceCents).toBeUndefined();
  });

  it("suppliers come with lead time and open PO count; inactive are hidden", async () => {
    // "Picker Lieferant" and its draft PO come from the previous test (same suite).
    await SupplierModel.create({
      name: "Inaktiver Lieferant",
      email: "inaktiv@example.ch",
      leadTimeDays: 3,
      active: false,
    });

    const open = await searchSuppliers("Picker");
    expect(open).toHaveLength(1);
    expect(open[0]?.leadTimeDays).toBe(7);
    expect(open[0]?.openPos).toBe(0); // the PO from the previous test is still a draft

    const ordered = await PurchaseOrderModel.findOne().lean().exec();
    const marked = await markPurchaseOrderOrderedCore(ordered!._id.toString());
    expect(marked.ok).toBe(true);
    const after = await searchSuppliers("Picker");
    expect(after[0]?.openPos).toBe(1);

    const all = await searchSuppliers("");
    expect(all.map((s) => s.name)).toEqual(["Picker Lieferant"]);

    const none = await searchSuppliers("Unbekannt");
    expect(none).toEqual([]);
  });
});
