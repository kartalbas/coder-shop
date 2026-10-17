import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { ProductModel } from "@/models/product";
import { OrderModel, type Order } from "@/models/order";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

function makeOrderFixture(orderNumber: string, reference: string): mongoose.mongo.OptionalId<Order> {
  const now = new Date();
  return {
    orderNumber,
    status: "new",
    statusLog: [{ status: "new", at: now }],
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
    payment: { method: "mock", kind: "immediate" as const, reference },
    createdAt: now,
    updatedAt: now,
  };
}

describe("database smoke (throw-away replica set)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("round-trips a Product document", async () => {
    const created = await ProductModel.create({
      slug: "test-telefon",
      name: "Test Telefon",
      description: "Ein Testtelefon.",
      type: "smartphone",
      brand: "Testmarke",
      priceCents: 99900,
      images: [{ src: "/products/test-telefon-1.svg", alt: "Test Telefon" }],
      featured: false,
      filter: { color: ["schwarz"], storage: ["256"] },
      variants: [
        {
          sku: "T-001",
          label: "256 GB / schwarz",
          priceDeltaCents: 0,
          stock: 10,
          restockThreshold: 5,
          weightGrams: 200,
          attributes: { color: "schwarz", storage: 256 },
        },
      ],
    });
    const found = await ProductModel.findOne({ slug: "test-telefon" }).lean();
    expect(found?.variants[0].sku).toBe("T-001");
    expect(found?.filter.storage).toEqual(["256"]);
    await ProductModel.deleteOne({ _id: created._id });
  });

  it("commits a transaction", async () => {
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await OrderModel.insertOne(makeOrderFixture("B-2026-000001", "P-1"), { session });
    });
    session.endSession();
    expect(await OrderModel.countDocuments({ orderNumber: "B-2026-000001" })).toBe(1);
  });

  it("aborts a transaction and writes nothing", async () => {
    const session = await mongoose.startSession();
    session.startTransaction();
    await OrderModel.insertOne(makeOrderFixture("B-2026-000002", "P-2"), { session });
    await session.abortTransaction();
    session.endSession();
    expect(await OrderModel.countDocuments({ orderNumber: "B-2026-000002" })).toBe(0);
  });
});
