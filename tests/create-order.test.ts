import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/pricing";
import { CounterModel } from "@/models/counter";
import { OrderModel, type Order } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { createOrderCore, formatOrderNumber } from "@/server/checkout";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CUSTOMER = {
  name: "Max Muster",
  email: "max.muster@example.ch",
  phone: "079 123 45 67",
  street: "Bahnhofstrasse 12",
  postalCode: "8001",
  city: "Zürich",
  country: "CH",
};

async function seedProduct(stock: number, tag: string, priceCents = 10000) {
  return ProductModel.create({
    slug: `checkout-test-${tag}`,
    name: `Checkout Test ${tag}`,
    description: "Produkt für Checkout-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/checkout-test-${tag}-1.svg`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku: `CT-${tag}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 500,
        stock,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

async function stockOf(sku: string): Promise<number> {
  const product = await ProductModel.findOne({ "variants.sku": sku }).lean<Product>().exec();
  return product?.variants.find((v) => v.sku === sku)?.stock ?? -1;
}

describe("createOrderCore", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("creates a paid order with a B-YYYY-###### number and decrements stock", async () => {
    await seedProduct(5, "valid");
    const result = await createOrderCore({
      lines: [{ sku: "CT-valid", qty: 2, expectedUnitPriceCents: 10500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.orderNumber).toMatch(/^B-\d{4}-\d{6}$/);
    expect(result.orderNumber).toBe(formatOrderNumber(new Date().getUTCFullYear(), 1));
    expect(result.totals).toEqual(
      computeTotals([{ unitPriceCents: 10500, qty: 2 }], "standard"),
    );

    const order = await OrderModel.findOne({ orderNumber: result.orderNumber }).lean<Order>().exec();
    expect(order).not.toBeNull();
    expect(order?.status).toBe("paid");
    expect(order?.statusLog.map((e) => e.status)).toEqual(["new", "paid"]);
    expect(order?.payment.method).toBe("mock");
    expect(order?.payment.paidAt).toBeInstanceOf(Date);
    expect(order?.lines[0]).toMatchObject({
      sku: "CT-valid",
      qty: 2,
      unitPriceCents: 10500,
      totalCents: 21000,
    });

    expect(await stockOf("CT-valid")).toBe(3);
  });

  it("mints gap-free incrementing order numbers", async () => {
    const first = await OrderModel.findOne().sort({ orderNumber: 1 }).lean();
    const result = await createOrderCore({
      lines: [{ sku: "CT-valid", qty: 1, expectedUnitPriceCents: 10500 }],
      customer: CUSTOMER,
      shippingMethod: "express",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const previousSeq = Number(first?.orderNumber.slice(-6));
    expect(result.orderNumber).toBe(formatOrderNumber(new Date().getUTCFullYear(), previousSeq + 1));
    expect(await stockOf("CT-valid")).toBe(2);
  });

  it("fails when ordering more than available stock and writes nothing", async () => {
    await seedProduct(2, "oversell");
    const ordersBefore = await OrderModel.countDocuments();
    const counterBefore = await CounterModel.findById("order").lean();

    const result = await createOrderCore({
      lines: [{ sku: "CT-oversell", qty: 5, expectedUnitPriceCents: 10500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("CT-oversell");
    expect(await stockOf("CT-oversell")).toBe(2);
    expect(await OrderModel.countDocuments()).toBe(ordersBefore);
    const counterAfter = await CounterModel.findById("order").lean();
    expect(counterAfter?.seq).toBe(counterBefore?.seq);
  });

  it("rejects an unknown sku", async () => {
    const result = await createOrderCore({
      lines: [{ sku: "CT-gibt-es-nicht", qty: 1, expectedUnitPriceCents: 10500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid customer data", async () => {
    const result = await createOrderCore({
      lines: [{ sku: "CT-valid", qty: 1, expectedUnitPriceCents: 10500 }],
      customer: { ...CUSTOMER, email: "keine-mail" },
      shippingMethod: "standard",
    });
    expect(result.ok).toBe(false);
    expect(await stockOf("CT-valid")).toBe(2);
  });

  it("rejects an empty cart", async () => {
    const result = await createOrderCore({
      lines: [],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses to order a sold-out variant when a sibling variant is well stocked (B1)", async () => {
    await ProductModel.create({
      slug: "checkout-test-multivariant",
      name: "Checkout Test Multivariant",
      description: "Ein Variant ausverkauft, der andere gut bestückt.",
      type: "smartphone",
      brand: "Testmarke",
      priceCents: 10000,
      images: [{ src: "/products/checkout-test-multivariant-1.svg", alt: "Test" }],
      featured: false,
      filter: { colors: ["schwarz", "weiß"], sizes: [], storage: [128], materials: [] },
      variants: [
        {
          sku: "CT-empty",
          label: "128 GB / schwarz",
          priceDeltaCents: 0,
          stock: 0,
          restockThreshold: 3,
          weightGrams: 200,
          attributes: { color: "schwarz", storage: 128 },
        },
        {
          sku: "CT-full",
          label: "128 GB / weiß",
          priceDeltaCents: 0,
          stock: 10,
          restockThreshold: 3,
          weightGrams: 200,
          attributes: { color: "weiß", storage: 128 },
        },
      ],
    });

    const result = await createOrderCore({
      lines: [{ sku: "CT-empty", qty: 5, expectedUnitPriceCents: 10500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });

    expect(result.ok).toBe(false);
    expect(await stockOf("CT-empty")).toBe(0);
    expect(await stockOf("CT-full")).toBe(10);
  });

  it("lets exactly one of two concurrent last-item orders succeed, stock never negative", async () => {
    await seedProduct(1, "race");
    const ordersBefore = await OrderModel.countDocuments();

    const [a, b] = await Promise.all([
      createOrderCore({
        lines: [{ sku: "CT-race", qty: 1, expectedUnitPriceCents: 10500 }],
        customer: CUSTOMER,
        shippingMethod: "standard",
      }),
      createOrderCore({
        lines: [{ sku: "CT-race", qty: 1, expectedUnitPriceCents: 10500 }],
        customer: CUSTOMER,
        shippingMethod: "standard",
      }),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    expect(successes).toHaveLength(1);
    expect(await stockOf("CT-race")).toBe(0);
    expect(await OrderModel.countDocuments()).toBe(ordersBefore + 1);
  });

  it("refuses the order when the database price differs from the displayed price (issue #12)", async () => {
    await seedProduct(5, "pricechange");
    const stale = await createOrderCore({
      lines: [{ sku: "CT-pricechange", qty: 2, expectedUnitPriceCents: 9500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.reason).toBe("price_changed");
    expect(stale.changed).toEqual([{ sku: "CT-pricechange", unitPriceCents: 10500 }]);
    expect(await stockOf("CT-pricechange")).toBe(5);

    // The admin raises the price; the customer who saw CHF 105.00 must not be charged 125.
    await ProductModel.updateOne(
      { "variants.sku": "CT-pricechange" },
      { $set: { priceCents: 12000 } },
    );
    const raised = await createOrderCore({
      lines: [{ sku: "CT-pricechange", qty: 2, expectedUnitPriceCents: 10500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(raised.ok).toBe(false);
    if (raised.ok) return;
    expect(raised.changed).toEqual([{ sku: "CT-pricechange", unitPriceCents: 12500 }]);
    expect(await stockOf("CT-pricechange")).toBe(5);

    // After the UI adopted the new price, the order goes through at exactly that price.
    const accepted = await createOrderCore({
      lines: [{ sku: "CT-pricechange", qty: 2, expectedUnitPriceCents: 12500 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(accepted.ok).toBe(true);
    const order = await OrderModel.findOne({ "lines.sku": "CT-pricechange" }).lean<Order>().exec();
    expect(order?.lines[0].unitPriceCents).toBe(12500);
    expect(order?.totals.totalCents).toBe(
      computeTotals([{ unitPriceCents: 12500, qty: 2 }], "standard").totalCents,
    );
  });

  it("lets 10 concurrent checkouts of different products all succeed (issue #11)", async () => {
    const n = 10;
    await Promise.all(
      Array.from({ length: n }, (_, i) => seedProduct(5, `parallel-${i}`)),
    );
    const ordersBefore = await OrderModel.countDocuments();

    const results = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        createOrderCore({
          lines: [{ sku: `CT-parallel-${i}`, qty: 1, expectedUnitPriceCents: 10500 }],
          customer: { ...CUSTOMER, email: `kaeufer-${i}@example.ch` },
          shippingMethod: "standard",
        }),
      ),
    );

    for (const [i, result] of results.entries()) {
      expect(result.ok, `checkout ${i}: ${result.ok ? "" : result.error}`).toBe(true);
    }
    const numbers = results.flatMap((r) => (r.ok ? [r.orderNumber] : []));
    expect(new Set(numbers).size).toBe(n);
    expect(await OrderModel.countDocuments()).toBe(ordersBefore + n);
    for (let i = 0; i < n; i++) expect(await stockOf(`CT-parallel-${i}`)).toBe(4);
  });
});

describe("order number format", () => {
  it("pads the sequence to six digits", () => {
    expect(formatOrderNumber(new Date().getUTCFullYear(), 1)).toBe("B-2026-000001");
    expect(formatOrderNumber(2026, 123456)).toBe("B-2026-123456");
  });
});
