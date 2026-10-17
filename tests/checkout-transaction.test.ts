import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { ProductModel } from "@/models/product";
import { OrderModel } from "@/models/order";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

async function seedProduct(stock: number, tag: string) {
  return ProductModel.create({
    slug: `ueberverkauf-test-${tag}`,
    name: "Überverkauf Test",
    description: "Produkt mit begrenztem Lager.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 10000,
    images: [{ src: `/products/ueberverkauf-test-${tag}-1.svg`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku: `OVER-${tag}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

describe("checkout transaction over-sell", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("aborts when stock is insufficient and writes nothing", async () => {
    const product = await seedProduct(2, "oversell");
    const qty = 5;

    const session = await mongoose.startSession();
    session.startTransaction();
    let sold = false;
    try {
      const updated = await ProductModel.findOneAndUpdate(
        { _id: product._id, "variants.sku": "OVER-oversell", "variants.stock": { $gte: qty } },
        { $inc: { "variants.$[v].stock": -qty } },
        { arrayFilters: [{ "v.sku": "OVER-oversell" }], session, returnDocument: "after" },
      ).lean();
      if (!updated) throw new Error("insufficient stock");
      await OrderModel.insertOne(
        {
          orderNumber: "B-2026-999999",
          status: "new",
          statusLog: [{ status: "new", at: new Date() }],
          customer: {
            name: "Test",
            email: "t@example.com",
            phone: "044 000 00 00",
            street: "Bahnhofstr. 1",
            postalCode: "8001",
            city: "Zürich",
            country: "CH",
          },
          lines: [],
          totals: { subtotalCents: 0, shippingCents: 0, totalCents: 0, vatCents: 0 },
          shipping: { method: "standard" },
          payment: { method: "mock", reference: "P-9" },
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never,
        { session },
      );
      await session.commitTransaction();
      sold = true;
    } catch {
      await session.abortTransaction();
    } finally {
      session.endSession();
    }

    expect(sold).toBe(false);
    const fresh = await ProductModel.findById(product._id).lean();
    expect(fresh?.variants[0].stock).toBe(2);
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("commits and decrements when stock is sufficient", async () => {
    const product = await seedProduct(10, "commit");
    const qty = 3;

    const session = await mongoose.startSession();
    session.startTransaction();
    const updated = await ProductModel.findOneAndUpdate(
      { _id: product._id, "variants.sku": "OVER-commit", "variants.stock": { $gte: qty } },
      { $inc: { "variants.$[v].stock": -qty } },
      { arrayFilters: [{ "v.sku": "OVER-commit" }], session, returnDocument: "after" },
    ).lean();
    expect(updated).not.toBeNull();
    await session.commitTransaction();
    session.endSession();

    const fresh = await ProductModel.findById(product._id).lean();
    expect(fresh?.variants[0].stock).toBe(7);
  });
});
