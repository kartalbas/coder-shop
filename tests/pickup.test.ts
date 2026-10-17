import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IllegalTransitionError, transition } from "@/lib/orders/state-machine";
import { OrderModel, type Order } from "@/models/order";
import { ProductModel } from "@/models/product";
import { createOrderCore } from "@/server/checkout";
import { listPackingQueue, transitionOrderCore } from "@/server/orders-admin";
import {
  generatePickupCode,
  handoverPickupCore,
  listPickupQueueCore,
  markPickupReadyCore,
  normalizePickupCode,
} from "@/server/pickup";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CUSTOMER = {
  name: "Vera Abholung",
  email: "vera@example.ch",
  phone: "079 222 33 44",
  street: "Dorfstrasse 3",
  postalCode: "8001",
  city: "Zürich",
  country: "CH",
};

async function seedProduct(stock: number, tag: string, priceCents = 10_000) {
  await ProductModel.create({
    slug: `pickup-test-${tag}`,
    name: `Pickup Test ${tag}`,
    description: "Produkt für Abhol-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/pickup-test-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku: `PU-${tag}`,
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

function pickupCheckout(sku: string, qty: number, paymentMethod: "pickup" | "mock" = "pickup") {
  return createOrderCore(
    {
      lines: [{ sku, qty, expectedUnitPriceCents: 10_000 }],
      customer: CUSTOMER,
      shippingMethod: "pickup",
      paymentMethod,
    },
    { userId: undefined },
  );
}

async function order(number: string) {
  return OrderModel.findOne({ orderNumber: number }).lean<Order>().exec();
}

describe("pickup code", () => {
  it("is 6 unambiguous characters and normalizes case/whitespace", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePickupCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
    expect(normalizePickupCode(" ab2cde ")).toBe("AB2CDE");
  });
});

describe("pickup checkout and handover (issue #41)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("creates an unpaid pickup order with a code and free shipping", async () => {
    await seedProduct(10, "create");
    const result = await pickupCheckout("PU-create", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const created = await order(result.orderNumber);
    expect(created?.status).toBe("new");
    expect(created?.payment.method).toBe("pickup");
    expect(created?.payment.paidAt).toBeUndefined();
    expect(created?.shipping.method).toBe("pickup");
    expect(created?.shipping.pickup?.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created?.totals.shippingCents).toBe(0);
    expect(created?.totals.totalCents).toBe(20_000);
    const product = await ProductModel.findOne({ "variants.sku": "PU-create" }).lean().exec();
    expect(product?.variants[0]?.stock).toBe(8);
  });

  it("rejects pickup payment without pickup shipping and invoice with pickup", async () => {
    const withStandard = await createOrderCore(
      {
        lines: [{ sku: "PU-create", qty: 1, expectedUnitPriceCents: 10_000 }],
        customer: CUSTOMER,
        shippingMethod: "standard",
        paymentMethod: "pickup",
      },
      { userId: undefined },
    );
    expect(withStandard.ok).toBe(false);

    const invoicePickup = await createOrderCore(
      {
        lines: [{ sku: "PU-create", qty: 1, expectedUnitPriceCents: 10_000 }],
        customer: CUSTOMER,
        shippingMethod: "pickup",
        paymentMethod: "invoice",
      },
      { userId: undefined },
    );
    expect(invoicePickup.ok).toBe(false);
  });

  it("runs the whole queue: ready, wrong code refused, right code collects and pays", async () => {
    await seedProduct(5, "flow");
    const result = await pickupCheckout("PU-flow", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await order(result.orderNumber);
    const orderId = created!._id.toString();
    const code = created!.shipping.pickup!.code;

    const queue = await listPickupQueueCore();
    expect(queue.map((item) => item.orderNumber)).toContain(result.orderNumber);

    // Packing queue never shows pickup orders (issue #41).
    // First move it to picking so it would match the packing status filter.
    const toPicking = await transitionOrderCore(orderId, "picking", { by: "admin@test" });
    expect(toPicking.ok).toBe(true);
    expect(await listPackingQueue()).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ orderNumber: result.orderNumber })]),
    );

    const ready = await markPickupReadyCore(orderId, "admin@test");
    expect(ready.ok).toBe(true);
    const readyOrder = await order(result.orderNumber);
    expect(readyOrder?.status).toBe("ready");
    expect(readyOrder?.shipping.pickup?.readyAt).toBeInstanceOf(Date);

    // The status buttons of a ready order offer the handover not at all —
    // it belongs to the pickup queue where the payment is recorded.
    await expect(
      transitionOrderCore(orderId, "picked_up", { by: "admin@test" }),
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    const wrongCode = await handoverPickupCore(orderId, "FALSCH", "cash", "admin@test");
    expect(wrongCode.ok).toBe(false);
    expect(wrongCode.ok === false && wrongCode.error).toMatch(/Abholcode/);
    expect((await order(result.orderNumber))?.status).toBe("ready");

    const handover = await handoverPickupCore(orderId, ` ${code.toLowerCase()} `, "card", "admin@test");
    expect(handover.ok).toBe(true);

    const done = await order(result.orderNumber);
    expect(done?.status).toBe("picked_up");
    expect(done?.payment.paidAt).toBeInstanceOf(Date);
    expect(done?.shipping.pickup?.pickedUpAt).toBeInstanceOf(Date);
    expect(done?.shipping.pickup?.paymentType).toBe("card");
    expect(done?.statusLog.map((e) => e.status)).toEqual(["new", "picking", "ready", "picked_up"]);

    // Gone from the queue; a second handover is impossible.
    expect((await listPickupQueueCore()).map((i) => i.orderNumber)).not.toContain(
      result.orderNumber,
    );
    const again = await handoverPickupCore(orderId, code, "cash", "admin@test");
    expect(again.ok).toBe(false);
  });

  it("can be marked ready directly from new", async () => {
    await seedProduct(5, "direct");
    const result = await pickupCheckout("PU-direct", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await order(result.orderNumber);

    const ready = await markPickupReadyCore(created!._id.toString(), "admin@test");
    expect(ready.ok).toBe(true);
    expect((await order(result.orderNumber))?.status).toBe("ready");
  });

  it("a card-paid pickup order is collected without a second payment", async () => {
    await seedProduct(5, "card");
    const result = await pickupCheckout("PU-card", 1, "mock");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await order(result.orderNumber);
    expect(created?.status).toBe("paid");
    expect(created?.payment.paidAt).toBeInstanceOf(Date);

    const ready = await markPickupReadyCore(created!._id.toString(), "admin@test");
    // paid → ready is not an edge — the admin moves it through picking first.
    expect(ready.ok).toBe(false);
    const toPicking = await transitionOrderCore(created!._id.toString(), "picking", {
      by: "admin@test",
    });
    expect(toPicking.ok).toBe(true);
    expect((await markPickupReadyCore(created!._id.toString(), "admin@test")).ok).toBe(true);

    const handover = await handoverPickupCore(
      created!._id.toString(),
      created!.shipping.pickup!.code,
      "card",
      "admin@test",
    );
    expect(handover.ok).toBe(true);
    const done = await order(result.orderNumber);
    expect(done?.status).toBe("picked_up");
    // paidAt is the checkout one, not overwritten by the handover.
    expect(done?.payment.paidAt?.getTime()).toBe(created?.payment.paidAt?.getTime());
  });

  it("cancelling a ready pickup order restocks the variants", async () => {
    await seedProduct(5, "cancel");
    const result = await pickupCheckout("PU-cancel", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await order(result.orderNumber);

    expect((await markPickupReadyCore(created!._id.toString(), "admin@test")).ok).toBe(true);
    const cancelled = await transitionOrderCore(created!._id.toString(), "cancelled", {
      by: "admin@test",
    });
    expect(cancelled.ok).toBe(true);

    const product = await ProductModel.findOne({ "variants.sku": "PU-cancel" }).lean().exec();
    expect(product?.variants[0]?.stock).toBe(5);
  });

  it("parcel orders cannot enter the pickup chain and pickup orders cannot ship", async () => {
    await seedProduct(5, "parcel");
    const parcel = await createOrderCore(
      {
        lines: [{ sku: "PU-parcel", qty: 1, expectedUnitPriceCents: 10_000 }],
        customer: CUSTOMER,
        shippingMethod: "standard",
        paymentMethod: "mock",
      },
      { userId: undefined },
    );
    expect(parcel.ok).toBe(true);
    if (!parcel.ok) return;
    const parcelOrder = await order(parcel.orderNumber);

    // paid → ready is not an edge at all; and even picking → ready is pickup-only.
    await OrderModel.updateOne(
      { _id: parcelOrder!._id },
      { $set: { status: "picking" } },
    );
    const ready = await markPickupReadyCore(parcelOrder!._id.toString(), "admin@test");
    expect(ready.ok).toBe(false);
    expect((await order(parcel.orderNumber))?.status).toBe("picking");

    // A pickup order in picking cannot go packed (it is collected, not shipped).
    await seedProduct(5, "nopacked");
    const pickup = await pickupCheckout("PU-nopacked", 1);
    expect(pickup.ok).toBe(true);
    if (!pickup.ok) return;
    const pickupOrder = await order(pickup.orderNumber);
    expect((await transitionOrderCore(pickupOrder!._id.toString(), "picking")).ok).toBe(true);
    await expect(
      transitionOrderCore(pickupOrder!._id.toString(), "packed"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    expect((await order(pickup.orderNumber))?.status).toBe("picking");
  });

  it("guest pickup checkout works without an account", async () => {
    await seedProduct(5, "guest");
    const result = await pickupCheckout("PU-guest", 1);
    expect(result.ok).toBe(true);
    const created = result.ok ? await order(result.orderNumber) : null;
    expect(created?.userId).toBeUndefined();
    expect(created?.shipping.pickup?.code).toBeDefined();
  });

  it("transition without a known context never leaks the unpaid or pickup edges", () => {
    // Defensive: transitionOrderCore always passes the context, but the pure
    // machine must default to the parcel rules.
    expect(() => transition({ status: "new", statusLog: [] }, "picking")).toThrow(
      IllegalTransitionError,
    );
    expect(() => transition({ status: "new", statusLog: [] }, "ready")).toThrow(
      IllegalTransitionError,
    );
    expect(() => transition({ status: "ready", statusLog: [] }, "picked_up")).toThrow(
      IllegalTransitionError,
    );
  });
});
