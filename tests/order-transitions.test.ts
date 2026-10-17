import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IllegalTransitionError } from "@/lib/orders/state-machine";
import { OrderModel, type Order, type OrderStatus } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { transitionOrderCore } from "@/server/orders-admin";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CHAIN: OrderStatus[] = ["new", "paid", "picking", "packed", "shipped", "delivered"];

async function seedProduct(sku: string, stock: number) {
  return ProductModel.create({
    slug: `transition-${sku}`,
    name: `Transition Produkt ${sku}`,
    description: "Produkt für Statuswechsel-Tests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 50000,
    images: [{ src: `/products/transition-${sku}-1.svg`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock,
        restockThreshold: 3,
        weightGrams: 250,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

async function seedOrder(status: OrderStatus, sku: string, qty: number, productId: unknown) {
  const chainUpTo = status === "cancelled" ? 1 : CHAIN.indexOf(status);
  const statusLog = CHAIN.slice(0, chainUpTo + 1).map((step, index) => ({
    status: step,
    at: new Date(Date.now() - (chainUpTo - index) * 60_000),
  }));
  const order = await OrderModel.create({
    orderNumber: `B-2026-9${String(await OrderModel.countDocuments()).padStart(5, "0")}`,
    status,
    statusLog,
    customer: {
      name: "Test Kunde",
      email: "test@example.ch",
      phone: "079 000 00 00",
      street: "Testweg 1",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    },
    lines: [
      {
        productId,
        sku,
        name: `Transition Produkt ${sku}`,
        variantLabel: "128 GB / schwarz",
        qty,
        unitPriceCents: 50000,
        totalCents: 50000 * qty,
        weightGrams: 250,
      },
    ],
    totals: { subtotalCents: 50000 * qty, shippingCents: 0, totalCents: 50000 * qty, vatCents: 0 },
    shipping: { method: "standard" },
    payment: { method: "mock", reference: "P-TEST" },
  });
  return order;
}

async function stockOf(sku: string): Promise<number> {
  const product = await ProductModel.findOne({ "variants.sku": sku }).lean<Product>().exec();
  return product?.variants.find((v) => v.sku === sku)?.stock ?? -1;
}

describe("transitionOrderCore", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("walks paid → picking → packed with one logged entry per step", async () => {
    const product = await seedProduct("TR-1", 10);
    const order = await seedOrder("paid", "TR-1", 2, product._id);

    const toPicking = await transitionOrderCore(order._id.toString(), "picking", {
      by: "admin@codershop.ch",
    });
    expect(toPicking).toEqual({ ok: true, status: "picking" });

    const toPacked = await transitionOrderCore(order._id.toString(), "packed", {
      by: "admin@codershop.ch",
    });
    expect(toPacked).toEqual({ ok: true, status: "packed" });

    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("packed");
    expect(fresh?.statusLog.map((e) => e.status)).toEqual([
      "new",
      "paid",
      "picking",
      "packed",
    ]);
    const logged = fresh?.statusLog.slice(2);
    expect(logged?.every((e) => e.at instanceof Date)).toBe(true);
    expect(logged?.every((e) => e.by === "admin@codershop.ch")).toBe(true);
  });

  it("throws IllegalTransitionError for packed → paid and writes nothing", async () => {
    const product = await seedProduct("TR-2", 10);
    const order = await seedOrder("packed", "TR-2", 1, product._id);
    const before = await OrderModel.findById(order._id).lean<Order>().exec();

    await expect(
      transitionOrderCore(order._id.toString(), "paid"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const after = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(after?.status).toBe("packed");
    expect(after?.statusLog).toEqual(before?.statusLog);
  });

  it("refuses the manual packed → shipped — only label creation may ship (issue #10)", async () => {
    const product = await seedProduct("TR-2b", 10);
    const order = await seedOrder("packed", "TR-2b", 1, product._id);

    await expect(
      transitionOrderCore(order._id.toString(), "shipped"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const after = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(after?.status).toBe("packed");
  });

  it("rejects a same-state transition", async () => {
    const product = await seedProduct("TR-3", 10);
    const order = await seedOrder("paid", "TR-3", 1, product._id);
    await expect(
      transitionOrderCore(order._id.toString(), "paid"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);
  });

  it("restocks on cancel from paid in the same transaction", async () => {
    const product = await seedProduct("TR-4", 10);
    const order = await seedOrder("paid", "TR-4", 3, product._id);
    expect(await stockOf("TR-4")).toBe(10);

    const result = await transitionOrderCore(order._id.toString(), "cancelled", {
      note: "Kunde zurückgetreten",
    });
    expect(result.ok).toBe(true);
    expect(await stockOf("TR-4")).toBe(13);

    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("cancelled");
    expect(fresh?.statusLog.at(-1)?.note).toBe("Kunde zurückgetreten");
  });

  it("restocks on cancel from new and picking", async () => {
    const newProduct = await seedProduct("TR-5", 5);
    const newOrder = await seedOrder("new", "TR-5", 2, newProduct._id);
    expect((await transitionOrderCore(newOrder._id.toString(), "cancelled")).ok).toBe(true);
    expect(await stockOf("TR-5")).toBe(7);

    const pickingProduct = await seedProduct("TR-6", 5);
    const pickingOrder = await seedOrder("picking", "TR-6", 4, pickingProduct._id);
    expect((await transitionOrderCore(pickingOrder._id.toString(), "cancelled")).ok).toBe(true);
    expect(await stockOf("TR-6")).toBe(9);
  });

  it("refuses cancel from packed and shipped (no restock)", async () => {
    const packedProduct = await seedProduct("TR-7", 5);
    const packedOrder = await seedOrder("packed", "TR-7", 1, packedProduct._id);
    await expect(
      transitionOrderCore(packedOrder._id.toString(), "cancelled"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    expect(await stockOf("TR-7")).toBe(5);

    const shippedProduct = await seedProduct("TR-8", 5);
    const shippedOrder = await seedOrder("shipped", "TR-8", 1, shippedProduct._id);
    await expect(
      transitionOrderCore(shippedOrder._id.toString(), "cancelled"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    expect(await stockOf("TR-8")).toBe(5);
  });

  it("returns an error for an unknown order", async () => {
    const result = await transitionOrderCore("000000000000000000000000", "picking");
    expect(result).toEqual({ ok: false, error: "Bestellung nicht gefunden." });
  });

  it("restocks exactly once when two cancels race (M1)", async () => {
    const product = await seedProduct("TR-9", 10);
    const order = await seedOrder("paid", "TR-9", 4, product._id);

    const results = await Promise.allSettled([
      transitionOrderCore(order._id.toString(), "cancelled"),
      transitionOrderCore(order._id.toString(), "cancelled"),
    ]);

    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && r.value.ok === true,
    );
    expect(succeeded).toHaveLength(1);
    expect(await stockOf("TR-9")).toBe(14);

    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("cancelled");
    expect(fresh?.statusLog.filter((e) => e.status === "cancelled")).toHaveLength(1);
  });
});
