import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canMoveUnit,
  normalizeSerial,
  unitMoveForOrderStatus,
  unitSourcesFor,
  type StockUnitStatus,
} from "@/lib/stock-units";
import { OrderModel, type Order } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { PurchaseOrderModel } from "@/models/purchase-order";
import { StockUnitModel, type StockUnit } from "@/models/stock-unit";
import { SupplierModel } from "@/models/supplier";
import { createOrderCore } from "@/server/checkout";
import { transitionOrderCore } from "@/server/orders-admin";
import {
  createPurchaseOrderCore,
  markPurchaseOrderOrderedCore,
  receivePurchaseOrderCore,
} from "@/server/purchasing";
import { MockUpsProvider } from "@/server/shipping/mock";
import { createLabelCore } from "@/server/shipping/label";
import { searchStockUnits } from "@/server/stock-units";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";
import { seedUnitsForSku } from "@/test/units";

const CUSTOMER = {
  name: "Nina Nakamura",
  email: "nina.nakamura@example.ch",
  phone: "079 555 33 22",
  street: "Seestrasse 4",
  postalCode: "3005",
  city: "Bern",
  country: "CH",
};

// Issue #62 (#54): a serial-tracked smartphone with `stock` units on the shelf.
async function seedSerialProduct(sku: string, stock: number, withUnits = true): Promise<void> {
  await ProductModel.create({
    slug: `units-${sku}`,
    name: `Serien Produkt ${sku}`,
    description: "Produkt für Seriennummern-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 80000,
    images: [{ src: `/products/units-${sku}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { color: ["schwarz"], storage: ["128"] },
    variants: [
      {
        sku,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock,
        restockThreshold: 3,
        weightGrams: 210,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
  if (withUnits) await seedUnitsForSku(sku, stock);
}

async function stockOf(sku: string): Promise<number> {
  const product = await ProductModel.findOne({ "variants.sku": sku }).lean<Product>().exec();
  return product?.variants.find((v) => v.sku === sku)?.stock ?? -1;
}

async function unitsOf(sku: string): Promise<StockUnit[]> {
  return StockUnitModel.find({ sku }).sort({ serial: 1 }).lean<StockUnit[]>().exec();
}

async function buy(sku: string, qty: number, email = CUSTOMER.email) {
  return createOrderCore({
    lines: [{ sku, qty, expectedUnitPriceCents: 80000 }],
    customer: { ...CUSTOMER, email },
    shippingMethod: "standard",
  });
}

async function orderOf(orderNumber: string): Promise<Order> {
  const order = await OrderModel.findOne({ orderNumber }).lean<Order>().exec();
  if (!order) throw new Error(`order ${orderNumber} missing`);
  return order;
}

describe("unit state machine (pure)", () => {
  it("walks in_stock → reserved → packed → shipped → sold with no skips", () => {
    expect(canMoveUnit("in_stock", "reserved")).toBe(true);
    expect(canMoveUnit("reserved", "packed")).toBe(true);
    expect(canMoveUnit("packed", "shipped")).toBe(true);
    expect(canMoveUnit("shipped", "sold")).toBe(true);
    expect(canMoveUnit("in_stock", "packed")).toBe(false);
    expect(canMoveUnit("reserved", "shipped")).toBe(false);
    expect(canMoveUnit("sold", "in_stock")).toBe(false);
  });

  it("a cancel releases every unsold unit back to the shelf", () => {
    for (const from of ["reserved", "packed", "shipped"] as StockUnitStatus[]) {
      expect(canMoveUnit(from, "in_stock")).toBe(true);
    }
    expect(unitSourcesFor("in_stock")).toEqual(["reserved", "packed", "shipped"]);
    // sold is reachable from shipped (parcel) and reserved (counter handover).
    expect(unitSourcesFor("sold")).toEqual(["reserved", "shipped"]);
  });

  it("maps order statuses to unit moves", () => {
    expect(unitMoveForOrderStatus("packed")).toEqual({ move: "packed", release: false });
    expect(unitMoveForOrderStatus("shipped")).toEqual({ move: "shipped", release: false });
    expect(unitMoveForOrderStatus("delivered")).toEqual({ move: "sold", release: false });
    expect(unitMoveForOrderStatus("picked_up")).toEqual({ move: "sold", release: false });
    expect(unitMoveForOrderStatus("cancelled")).toEqual({ move: null, release: true });
    expect(unitMoveForOrderStatus("picking")).toEqual({ move: null, release: false });
  });

  it("normalises and bounds serial input", () => {
    expect(normalizeSerial("  35-1345/6789  ")).toBe("35-1345/6789");
    expect(normalizeSerial("kurz")).toBe("kurz");
    expect(normalizeSerial("kur")).toBeNull();
    expect(normalizeSerial("mit leer space")).toBeNull();
    expect(normalizeSerial("x".repeat(65))).toBeNull();
  });
});

describe("serial stock (issue #62/#54)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("goods receipt registers every piece; variant stock is the unit count", async () => {
    await seedSerialProduct("SU-REC", 0, false);
    const supplier = await SupplierModel.create({
      name: "Serial Lieferant",
      email: "serial@example.ch",
      leadTimeDays: 5,
      active: true,
    });
    const created = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [{ sku: "SU-REC", qty: 3, unitPriceCents: 60000 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await markPurchaseOrderOrderedCore(created.poId)).ok).toBe(true);

    // Without serials the receipt is refused — nothing moves.
    const missing = await receivePurchaseOrderCore(created.poId);
    expect(missing.ok).toBe(false);
    expect(await stockOf("SU-REC")).toBe(0);
    expect(await StockUnitModel.countDocuments({ sku: "SU-REC" })).toBe(0);

    // Duplicate inside the batch is refused.
    const dupBatch = await receivePurchaseOrderCore(created.poId, undefined, {
      "SU-REC": ["SU-DUP-1", "SU-DUP-1", "SU-DUP-2"],
    });
    expect(dupBatch.ok).toBe(false);
    expect(await stockOf("SU-REC")).toBe(0);

    const received = await receivePurchaseOrderCore(created.poId, undefined, {
      "SU-REC": ["SU-REC-001", "SU-REC-002", "SU-REC-003"],
    });
    expect(received.ok).toBe(true);
    expect(await stockOf("SU-REC")).toBe(3);
    const units = await unitsOf("SU-REC");
    expect(units.map((u) => u.serial)).toEqual(["SU-REC-001", "SU-REC-002", "SU-REC-003"]);
    expect(units.every((u) => u.status === "in_stock")).toBe(true);
    expect(units[0]?.history[0]).toMatchObject({
      status: "in_stock",
      note: `Wareneingang ${created.poNumber}`,
    });
    expect(units[0]?.purchaseOrderId?.toString()).toBe(created.poId);

    // A serial already on the ledger is refused, even from another PO.
    const second = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [{ sku: "SU-REC", qty: 1, unitPriceCents: 60000 }],
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect((await markPurchaseOrderOrderedCore(second.poId)).ok).toBe(true);
    const dupLedger = await receivePurchaseOrderCore(second.poId, undefined, {
      "SU-REC": ["SU-REC-002"],
    });
    expect(dupLedger.ok).toBe(false);
    if (dupLedger.ok) return;
    expect(dupLedger.error).toContain("SU-REC-002");
    expect(await stockOf("SU-REC")).toBe(3);
  });

  it("a sale reserves exact units and records them on the order line", async () => {
    await seedSerialProduct("SU-SALE", 3);
    const result = await buy("SU-SALE", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await orderOf(result.orderNumber);
    const serials = order.lines[0]?.serials ?? [];
    expect(serials).toHaveLength(2);
    expect(new Set(serials).size).toBe(2);

    const reserved = await StockUnitModel.find({ serial: { $in: serials } })
      .lean<StockUnit[]>()
      .exec();
    expect(reserved).toHaveLength(2);
    for (const unit of reserved) {
      expect(unit.status).toBe("reserved");
      expect(unit.orderNumber).toBe(result.orderNumber);
      expect(unit.history.map((h) => h.status)).toEqual(["in_stock", "reserved"]);
    }
    expect(await StockUnitModel.countDocuments({ sku: "SU-SALE", status: "in_stock" })).toBe(1);
    expect(await stockOf("SU-SALE")).toBe(1);
  });

  it("travels packed → shipped → delivered and books the unit out", async () => {
    await seedSerialProduct("SU-TRAVEL", 1);
    const result = await buy("SU-TRAVEL", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await orderOf(result.orderNumber);
    const serial = order.lines[0]?.serials?.[0] ?? "";

    expect((await transitionOrderCore(order._id.toString(), "picking")).ok).toBe(true);
    expect((await transitionOrderCore(order._id.toString(), "packed")).ok).toBe(true);
    expect(
      await StockUnitModel.countDocuments({ serial, status: "packed", orderNumber: result.orderNumber }),
    ).toBe(1);

    // packed → shipped only goes through the label (issue #10) — units travel with it.
    expect((await createLabelCore(order._id.toString(), new MockUpsProvider())).ok).toBe(true);
    expect(
      await StockUnitModel.countDocuments({ serial, status: "shipped", orderNumber: result.orderNumber }),
    ).toBe(1);

    expect((await transitionOrderCore(order._id.toString(), "delivered")).ok).toBe(true);
    const unit = await StockUnitModel.findOne({ serial }).lean<StockUnit>().exec();
    expect(unit?.status).toBe("sold");
    expect(unit?.history.map((h) => h.status)).toEqual([
      "in_stock",
      "reserved",
      "packed",
      "shipped",
      "sold",
    ]);
    // Sold means out of stock: the shelf count and the variant stock agree at 0.
    expect(await StockUnitModel.countDocuments({ sku: "SU-TRAVEL", status: "in_stock" })).toBe(0);
    expect(await stockOf("SU-TRAVEL")).toBe(0);
  });

  it("a cancel releases the units back to the shelf", async () => {
    await seedSerialProduct("SU-CANCEL", 2);
    const result = await buy("SU-CANCEL", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await orderOf(result.orderNumber);

    expect((await transitionOrderCore(order._id.toString(), "cancelled")).ok).toBe(true);
    const units = await unitsOf("SU-CANCEL");
    expect(units.every((u) => u.status === "in_stock")).toBe(true);
    expect(units.every((u) => u.orderNumber === undefined || u.orderNumber === null)).toBe(true);
    expect(units[0]?.history.at(-1)).toMatchObject({ status: "in_stock" });
    expect(await stockOf("SU-CANCEL")).toBe(2);
  });

  it("traces a serial from purchase order over the sale to the customer order", async () => {
    await seedSerialProduct("SU-TRACE", 0, false);
    const supplier = await SupplierModel.create({
      name: "Trace Lieferant",
      email: "trace@example.ch",
      leadTimeDays: 4,
      active: true,
    });
    const created = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [{ sku: "SU-TRACE", qty: 1, unitPriceCents: 61000 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await markPurchaseOrderOrderedCore(created.poId)).ok).toBe(true);
    expect(
      (await receivePurchaseOrderCore(created.poId, undefined, { "SU-TRACE": ["IMEI-TRACE-1"] })).ok,
    ).toBe(true);

    const result = await buy("SU-TRACE", 1, "kaeuferin@example.ch");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await orderOf(result.orderNumber)).lines[0]?.serials).toEqual(["IMEI-TRACE-1"]);

    const unit = await StockUnitModel.findOne({ serial: "IMEI-TRACE-1" }).lean<StockUnit>().exec();
    expect(unit?.purchaseOrderId?.toString()).toBe(created.poId);
    expect(unit?.orderNumber).toBe(result.orderNumber);
    const po = await PurchaseOrderModel.findById(created.poId).lean().exec();
    expect(po?.lines[0]?.sku).toBe("SU-TRACE");

    // #62 review: the admin ledger view itself carries the trace — PO number in the
    // search result and in the receipt history note, not just the raw id in the DB.
    const [listed] = await searchStockUnits("IMEI-TRACE-1");
    expect(listed?.purchaseOrderNumber).toBe(created.poNumber);
    expect(listed?.history[0]?.note).toBe(`Wareneingang ${created.poNumber}`);
  });

  it("refuses a sale whose units are missing and writes nothing", async () => {
    // Migration case (#54): quantity stock existed before serial tracking started —
    // the number is on the variant but no unit document is on the ledger.
    await seedSerialProduct("SU-LEGACY", 2, false);
    const ordersBefore = await OrderModel.countDocuments();

    const result = await buy("SU-LEGACY", 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("SU-LEGACY");

    expect(await stockOf("SU-LEGACY")).toBe(2);
    expect(await OrderModel.countDocuments()).toBe(ordersBefore);
  });

  it("two parallel sales of one in-stock unit: exactly one wins", async () => {
    await seedSerialProduct("SU-RACE", 1);
    const [a, b] = await Promise.all([
      buy("SU-RACE", 1, "eins@example.ch"),
      buy("SU-RACE", 1, "zwei@example.ch"),
    ]);
    const successes = [a, b].filter((r) => r.ok);
    expect(successes).toHaveLength(1);
    expect(await StockUnitModel.countDocuments({ sku: "SU-RACE", status: "reserved" })).toBe(1);
    expect(await stockOf("SU-RACE")).toBe(0);
  });
});
