import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { OrderModel, type Order } from "@/models/order";
import { ProductModel } from "@/models/product";
import { ReviewModel } from "@/models/review";
import { UserModel } from "@/models/user";
import { getProductBySlug } from "@/server/search";
import {
  getProductReviewsCore,
  getUserReviewCore,
  hasPurchasedCore,
  listReviewsCore,
  replyToReviewCore,
  setReviewStatusCore,
  submitReviewCore,
} from "@/server/reviews";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const BUYER_EMAIL = "kauferin@example.ch";
const OTHER_EMAIL = "zuschauerin@example.ch";

async function seedProduct(slug: string) {
  await ProductModel.create({
    slug,
    name: `Testprodukt ${slug}`,
    description: "Produkt für Bewertungs-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 50_000,
    images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
    featured: false,
    filter: {  color: ["schwarz"], size: [], storage: ["128"], material: []  },
    variants: [
      {
        sku: `RV-${slug}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

function makeOrder(
  orderNumber: string,
  userId: string,
  productId: string,
  status: Order["status"],
): mongoose.mongo.OptionalId<Order> {
  const now = new Date();
  return {
    orderNumber,
    status,
    statusLog: [{ status, at: now }],
    userId: new mongoose.Types.ObjectId(userId),
    customer: {
      name: "Test",
      email: BUYER_EMAIL,
      phone: "044 000 00 00",
      street: "Bahnhofstr. 1",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    },
    lines: [
      {
        productId: new mongoose.Types.ObjectId(productId),
        sku: "RV-produkt-a",
        name: "Testprodukt produkt-a",
        variantLabel: "128 GB / schwarz",
        qty: 1,
        unitPriceCents: 50_000,
        totalCents: 50_000,
        weightGrams: 200,
      },
    ],
    totals: { subtotalCents: 50_000, shippingCents: 490, totalCents: 50_490, vatCents: 3786 },
    shipping: { method: "standard" },
    payment: { method: "mock", kind: "immediate", reference: `P-${orderNumber}` },
    createdAt: now,
    updatedAt: now,
  };
}

describe("product reviews (issue #47)", () => {
  let productId: string;
  let buyerId: string;
  let otherId: string;

  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    const buyer = await UserModel.create({
      email: BUYER_EMAIL,
      name: "Kauf Person",
      passwordHash: "scrypt$2$8$1$c2FsdA==$aGFzaA==",
      role: "customer",
    });
    const other = await UserModel.create({
      email: OTHER_EMAIL,
      name: "Andere Person",
      passwordHash: "scrypt$2$8$1$c2FsdA==$aGFzaA==",
      role: "customer",
    });
    buyerId = buyer._id.toString();
    otherId = other._id.toString();
    await seedProduct("produkt-a");
    await seedProduct("produkt-b");
    const product = await ProductModel.findOne({ slug: "produkt-a" }).lean().exec();
    productId = String(product!._id);
  });

  afterAll(disconnectTestDB);

  it("only buyers of the product can submit, and the review starts pending", async () => {
    expect(await hasPurchasedCore(buyerId, productId)).toBe(false);
    const refused = await submitReviewCore({
      userId: otherId,
      productId,
      rating: 5,
      body: "Klasse Produkt, sehr empfehlenswert.",
    });
    expect(refused.ok).toBe(false);

    await OrderModel.insertOne(makeOrder("B-2026-100001", buyerId, productId, "paid"));
    expect(await hasPurchasedCore(buyerId, productId)).toBe(true);

    const submitted = await submitReviewCore({
      userId: buyerId,
      productId,
      rating: 5,
      title: "Top",
      body: "Klasse Produkt, sehr empfehlenswert.",
    });
    expect(submitted.ok).toBe(true);
    const own = await getUserReviewCore(buyerId, productId);
    expect(own?.status).toBe("pending");
    expect(own?.authorName).toBe("Kauf Person");
  });

  it("a cancelled or never-paid order proves nothing", async () => {
    const cancelled = await OrderModel.create(
      makeOrder("B-2026-100002", otherId, productId, "cancelled"),
    );
    expect(await hasPurchasedCore(otherId, productId)).toBe(false);
    await OrderModel.updateOne({ _id: cancelled._id }, { $set: { status: "new" } });
    expect(await hasPurchasedCore(otherId, productId)).toBe(false);
    await OrderModel.updateOne({ _id: cancelled._id }, { $set: { status: "picked_up" } });
    expect(await hasPurchasedCore(otherId, productId)).toBe(true);
    await OrderModel.deleteOne({ _id: cancelled._id });
  });

  it("one review per buyer and product", async () => {
    const second = await submitReviewCore({
      userId: buyerId,
      productId,
      rating: 3,
      body: "Doch nur drei Sterne, ehrlich gesagt.",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/bereits bewertet/);
  });

  it("pending reviews stay invisible; approval publishes them with the right average", async () => {
    const hidden = await getProductReviewsCore(productId);
    expect(hidden.reviews).toHaveLength(0);
    expect(hidden.aggregate.count).toBe(0);

    // A second buyer with a delivered order rates 4 → approval gives (5+4)/2 = 4.5.
    const secondBuyer = await UserModel.create({
      email: "zweite@example.ch",
      name: "Zweite Person",
      passwordHash: "scrypt$2$8$1$c2FsdA==$aGFzaA==",
      role: "customer",
    });
    await OrderModel.insertOne(
      makeOrder("B-2026-100003", String(secondBuyer._id), productId, "delivered"),
    );
    const alsoSubmitted = await submitReviewCore({
      userId: String(secondBuyer._id),
      productId,
      rating: 4,
      body: "Gutes Telefon, Akku könnte besser sein.",
    });
    expect(alsoSubmitted.ok).toBe(true);

    const pending = await listReviewsCore("pending");
    expect(pending).toHaveLength(2);

    for (const review of pending) {
      const approved = await setReviewStatusCore(review.id, "approved");
      expect(approved.ok).toBe(true);
    }

    const published = await getProductReviewsCore(productId);
    expect(published.reviews).toHaveLength(2);
    expect(published.aggregate.average).toBe(4.5);
    expect(published.aggregate.count).toBe(2);
    expect(published.aggregate.distribution).toEqual([0, 0, 0, 1, 1]);

    // The denormalized product rating (cards, sorting, JSON-LD) follows.
    const dto = await getProductBySlug("produkt-a");
    expect(dto?.rating).toEqual({ average: 4.5, count: 2 });
  });

  it("hiding a review removes it from the public view and the average", async () => {
    const approved = await listReviewsCore("approved");
    const fiveStars = approved.find((review) => review.rating === 5)!;
    const hidden = await setReviewStatusCore(fiveStars.id, "hidden");
    expect(hidden.ok).toBe(true);

    const view = await getProductReviewsCore(productId);
    expect(view.reviews).toHaveLength(1);
    expect(view.aggregate.average).toBe(4);
    const dto = await getProductBySlug("produkt-a");
    expect(dto?.rating).toEqual({ average: 4, count: 1 });
  });

  it("an admin answer is stored and shown with the review", async () => {
    const approved = await listReviewsCore("approved");
    const replied = await replyToReviewCore(approved[0]!.id, "Danke für das Feedback!");
    expect(replied.ok).toBe(true);
    const view = await getProductReviewsCore(productId);
    expect(view.reviews[0]?.adminReply).toBe("Danke für das Feedback!");
    expect((await replyToReviewCore("kein-object-id", "Text")).ok).toBe(false);
  });

  it("unknown products and junk ids are clean errors", async () => {
    const unknown = await submitReviewCore({
      userId: buyerId,
      productId: new mongoose.Types.ObjectId().toString(),
      rating: 5,
      body: "Produkt gibt es gar nicht, trotzdem versuchen.",
    });
    expect(unknown.ok).toBe(false);
    expect((await setReviewStatusCore("müll", "approved")).ok).toBe(false);
    expect(await ReviewModel.countDocuments()).toBe(2);
  });
});
