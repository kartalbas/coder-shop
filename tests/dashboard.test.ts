import { HAPPY_PATH } from "@/lib/orders/state-machine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isLowStock } from "@/lib/stock";
import { OrderModel, type OrderStatus, type StatusLogEntry } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { getDashboardData, getLowStockVariants } from "@/server/dashboard";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-15T12:00:00.000Z");

async function seedVariantProduct(
  slug: string,
  variants: { sku: string; stock: number; restockThreshold: number }[],
) {
  return ProductModel.create({
    slug,
    name: `Dashboard ${slug}`,
    description: "Produkt für Dashboard-Tests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 10000,
    images: [{ src: `/products/${slug}-1.svg`, alt: "Test" }],
    featured: false,
    filter: {  color: ["schwarz"], size: [], storage: ["128"], material: []  },
    variants: variants.map((v) => ({
      sku: v.sku,
      label: `128 GB / ${v.sku}`,
      priceDeltaCents: 0,
      stock: v.stock,
      restockThreshold: v.restockThreshold,
      weightGrams: 200,
      attributes: { color: "schwarz", storage: 128 },
    })),
  });
}

async function seedOrder(
  orderNumber: string,
  status: OrderStatus,
  totalCents: number,
  createdAt: Date,
) {
  const chainUpTo = status === "cancelled" ? 1 : HAPPY_PATH.indexOf(status);
  const statusLog: StatusLogEntry[] = HAPPY_PATH.slice(0, chainUpTo + 1).map((step, index) => ({
    status: step,
    at: new Date(createdAt.getTime() + index * 60_000),
  }));
  if (status === "cancelled") {
    statusLog.push({ status: "cancelled", at: new Date(createdAt.getTime() + 2 * 60_000) });
  }
  return OrderModel.create({
    orderNumber,
    status,
    statusLog,
    customer: {
      name: `Kunde ${orderNumber}`,
      email: `${orderNumber.toLowerCase()}@example.ch`,
      phone: "079 000 00 00",
      street: "Testweg 1",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    },
    lines: [
      {
        productId: new ProductModel()._id,
        sku: `DASH-${orderNumber}`,
        name: "Dashboard Produkt",
        variantLabel: "128 GB / schwarz",
        qty: 1,
        unitPriceCents: totalCents,
        totalCents,
        weightGrams: 200,
      },
    ],
    totals: {
      subtotalCents: totalCents,
      shippingCents: 0,
      totalCents,
      vatCents: Math.round(totalCents - (totalCents * 100) / 108.1),
    },
    shipping: { method: "standard" },
    payment: { method: "mock", reference: `P-${orderNumber}` },
    createdAt,
  });
}

describe("dashboard data", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();

    await seedVariantProduct("low-a", [
      { sku: "DASH-LOW-1", stock: 2, restockThreshold: 5 },
      { sku: "DASH-OK-1", stock: 50, restockThreshold: 5 },
      { sku: "DASH-LOW-2", stock: 0, restockThreshold: 3 },
    ]);
    await seedVariantProduct("low-b", [
      { sku: "DASH-LOW-3", stock: 5, restockThreshold: 5 },
      { sku: "DASH-OK-2", stock: 10, restockThreshold: 2 },
    ]);

    await seedOrder("B-2026-700001", "paid", 10000, new Date(NOW.getTime() - 2 * DAY_MS));
    await seedOrder("B-2026-700002", "shipped", 20000, new Date(NOW.getTime() - 10 * DAY_MS));
    await seedOrder("B-2026-700003", "delivered", 5000, new Date(NOW.getTime() - 29 * DAY_MS));
    await seedOrder("B-2026-700004", "new", 99999, new Date(NOW.getTime() - 1 * DAY_MS));
    await seedOrder("B-2026-700005", "cancelled", 88888, new Date(NOW.getTime() - 3 * DAY_MS));
    await seedOrder("B-2026-700006", "paid", 77777, new Date(NOW.getTime() - 40 * DAY_MS));
    await seedOrder("B-2026-700007", "picking", 1000, new Date(NOW.getTime() - 5 * DAY_MS));
    await seedOrder("B-2026-700008", "packed", 2000, new Date(NOW.getTime() - 6 * DAY_MS));
    // Issue #17: 2026-09-15T22:30Z is 00:30 on 16 Sep in Zurich — the first instant of the
    // oldest window day; 21:30Z is still 15 Sep in Zurich and must stay outside the window.
    await seedOrder("B-2026-700009", "paid", 3000, new Date("2026-09-15T22:30:00.000Z"));
    await seedOrder("B-2026-700010", "paid", 4444, new Date("2026-09-15T21:30:00.000Z"));
  });

  afterAll(disconnectTestDB);

  it("sums revenue over paid|picking|packed|shipped|delivered within 30 days", async () => {
    const data = await getDashboardData(NOW);

    expect(data.revenueCents).toBe(10000 + 20000 + 5000 + 1000 + 2000 + 3000);
    expect(data.revenueCents).toBeGreaterThan(0);
    expect(data.revenueSeries).toHaveLength(30);
    expect(data.revenueSeries.reduce((sum, value) => sum + value, 0)).toBe(data.revenueCents);
    // the day 2 days ago holds exactly the 10000 order
    expect(data.revenueSeries[27]).toBe(10000);
    // the oldest Swiss day starts at 22:00 UTC the evening before — its orders count (issue #17):
    // the 5000 order (12:00Z) and the 3000 order (00:30 Zurich) share that Swiss day
    expect(data.revenueSeries[0]).toBe(5000 + 3000);
  });

  it("counts open orders and pending shipments", async () => {
    const data = await getDashboardData(NOW);
    // new(1) + paid(4, incl. the two issue #17 boundary orders) + picking(1) + packed(1)
    expect(data.openOrders).toBe(7);
    expect(data.pendingShipments).toBe(1);
  });

  it("low-stock table matches the query (stock ≤ restockThreshold)", async () => {
    const products = await ProductModel.find()
      .lean<Pick<Product, "name" | "variants">[]>()
      .exec();
    const expected = products
      .flatMap((product) => product.variants.map((variant) => ({ product, variant })))
      .filter(({ variant }) => isLowStock(variant.stock, variant.restockThreshold))
      .map(({ variant }) => variant.sku)
      .sort();

    const rows = await getLowStockVariants();
    expect(rows.map((row) => row.sku).sort()).toEqual(expected);
    expect(rows.map((row) => row.sku).sort()).toEqual([
      "DASH-LOW-1",
      "DASH-LOW-2",
      "DASH-LOW-3",
    ]);
    // sorted by stock ascending
    expect(rows.map((row) => row.stock)).toEqual([...rows.map((r) => r.stock)].sort((a, b) => a - b));
  });

  it("returns recent orders newest first", async () => {
    const data = await getDashboardData(NOW);
    expect(data.recentOrders.length).toBeLessThanOrEqual(8);
    const dates = data.recentOrders.map((order) => order.createdAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    expect(data.recentOrders[0]?.orderNumber).toBe("B-2026-700004");
  });
});
