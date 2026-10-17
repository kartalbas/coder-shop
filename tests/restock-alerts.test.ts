import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MailMessageModel } from "@/models/mail-message";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { RestockAlertModel } from "@/models/restock-alert";
import { SupplierModel } from "@/models/supplier";
import { createOrderCore } from "@/server/checkout";
import {
  createPurchaseOrderCore,
  createSupplierCore,
  markPurchaseOrderOrderedCore,
  receivePurchaseOrderCore,
} from "@/server/purchasing";
import { notifyRestockedCore, subscribeRestockAlertCore } from "@/server/restock-alerts";
import { transitionOrderCore } from "@/server/orders-admin";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CUSTOMER = {
  name: "Alarm Person",
  email: "alarm@example.ch",
  phone: "079 222 33 44",
  street: "Testweg 9",
  postalCode: "8001",
  city: "Zürich",
  country: "CH",
};

async function seedProduct(slug: string, sku: string, stock: number) {
  await ProductModel.create({
    slug,
    name: `Alarm Produkt ${slug}`,
    description: "Produkt für Wieder-verfügbar-Tests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 30_000,
    images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
    featured: false,
    filter: {  color: ["schwarz"], size: [], storage: ["128"], material: []  },
    variants: [
      {
        sku,
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

async function mailsTo(to: string) {
  return MailMessageModel.find({ to }).sort({ _id: 1 }).lean().exec();
}

describe("back-in-stock alerts (issue #46)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("subscribes once per (sku, e-mail) and refuses unknown articles", async () => {
    await seedProduct("alarm-a", "AL-A", 0);

    expect(await subscribeRestockAlertCore("GIBTS-NICHT", "x@example.ch")).toEqual({
      ok: false,
      error: "Artikel nicht gefunden.",
    });

    const first = await subscribeRestockAlertCore("AL-A", "Wartend@Example.ch ");
    expect(first).toEqual({ ok: true, inStock: false });
    // The same address again (different case) stays one document.
    expect(await subscribeRestockAlertCore("AL-A", "wartend@example.ch")).toEqual({
      ok: true,
      inStock: false,
    });
    expect(await RestockAlertModel.countDocuments({ sku: "AL-A" })).toBe(1);
  });

  it("an in-stock variant needs no alert", async () => {
    await seedProduct("alarm-b", "AL-B", 4);
    expect(await subscribeRestockAlertCore("AL-B", "sofort@example.ch")).toEqual({
      ok: true,
      inStock: true,
    });
    expect(await RestockAlertModel.countDocuments({ sku: "AL-B" })).toBe(0);
  });

  it("goods receipt mails every waiting address exactly once", async () => {
    await seedProduct("alarm-c", "AL-C", 0);
    await subscribeRestockAlertCore("AL-C", "eine@example.ch");
    await subscribeRestockAlertCore("AL-C", "zweite@example.ch");

    expect(
      (await createSupplierCore({
        name: "Alarm Lieferant",
        email: "kontakt@alarm-lieferant.ch",
        leadTimeDays: 5,
        active: true,
      })).ok,
    ).toBe(true);
    const supplier = await SupplierModel.findOne({ name: "Alarm Lieferant" }).lean().exec();
    const created = await createPurchaseOrderCore({
      supplierId: supplier!._id.toString(),
      lines: [{ sku: "AL-C", qty: 10, unitPriceCents: 20_000 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await markPurchaseOrderOrderedCore(created.poId)).ok).toBe(true);

    const received = await receivePurchaseOrderCore(created.poId);
    expect(received.ok).toBe(true);

    for (const to of ["eine@example.ch", "zweite@example.ch"]) {
      const mails = await mailsTo(to);
      expect(mails).toHaveLength(1);
      expect(mails[0].subject).toBe("Wieder an Lager");
      expect(mails[0].text).toContain("Alarm Produkt alarm-c");
      expect(mails[0].text).toContain("128 GB / schwarz");
      expect(mails[0].text).toContain("/products/alarm-c");
    }
    expect(await RestockAlertModel.countDocuments({ sku: "AL-C", notifiedAt: { $ne: null } })).toBe(2);

    // A second restock of the same sku does not mail the waiting addresses again.
    expect(await notifyRestockedCore(["AL-C"])).toBe(0);
  });

  it("no mail while the variant is still sold out", async () => {
    await seedProduct("alarm-d", "AL-D", 0);
    await subscribeRestockAlertCore("AL-D", "geduld@example.ch");
    expect(await notifyRestockedCore(["AL-D"])).toBe(0);
    expect(await mailsTo("geduld@example.ch")).toHaveLength(0);
  });

  it("a cancel that restocks also notifies", async () => {
    await seedProduct("alarm-e", "AL-E", 1);
    const order = await createOrderCore({
      lines: [{ sku: "AL-E", qty: 1, expectedUnitPriceCents: 30_000 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(order.ok).toBe(true);
    if (!order.ok) return;

    // The last piece is sold — now somebody waits.
    expect(await subscribeRestockAlertCore("AL-E", "ruediger@example.ch")).toEqual({
      ok: true,
      inStock: false,
    });

    const cancelled = await transitionOrderCore(
      (await OrderModel.findOne({ orderNumber: order.orderNumber }).lean().exec())!._id.toString(),
      "cancelled",
    );
    expect(cancelled.ok).toBe(true);

    const mails = await mailsTo("ruediger@example.ch");
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("Wieder an Lager");
  });
});
