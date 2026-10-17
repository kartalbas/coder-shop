import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/pricing";
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from "@/lib/shop-settings";
import { OrderModel, type Order } from "@/models/order";
import { ProductModel } from "@/models/product";
import { ShopSettingsModel } from "@/models/shop-settings";
import { UserModel } from "@/models/user";
import { createOrderCore } from "@/server/checkout";
import { hashPassword } from "@/server/password";
import { getShopSettings, saveShopSettingsCore } from "@/server/shop-settings";
import { seedShopSettings } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #64 done-when: changing the VAT rate, a shipping price or the payment-method
// set needs no code change — the checkout books exactly what the configuration says,
// and a method added at runtime works end to end.

const CUSTOMER = {
  name: "Konfig Person",
  email: "konfig@example.ch",
  phone: "079 000 00 00",
  street: "Testweg 1",
  postalCode: "8000",
  city: "Zürich",
  country: "CH",
};

function baseSettings(): ShopSettings {
  return structuredClone(DEFAULT_SHOP_SETTINGS);
}

async function seedProduct(tag: string, priceCents = 10000, stock = 10) {
  await ProductModel.create({
    slug: `settings-test-${tag}`,
    name: `Settings Test ${tag}`,
    description: "Produkt für Konfigurations-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/settings-test-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { color: ["schwarz"], storage: ["128"] },
    variants: [
      {
        sku: `ST-${tag}`,
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

async function checkout(tag: string, shippingMethod: string, paymentMethod: string, opts: { userId?: string } = {}) {
  return createOrderCore(
    {
      lines: [{ sku: `ST-${tag}`, qty: 1, expectedUnitPriceCents: 10000 }],
      customer: CUSTOMER,
      shippingMethod,
      paymentMethod,
    },
    opts,
  );
}

describe("shop settings (issue #64)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("falls back to the seed content while the collection is empty", async () => {
    expect(await getShopSettings()).toEqual(DEFAULT_SHOP_SETTINGS);
  });

  it("validates the configuration shape", async () => {
    expect((await saveShopSettingsCore({ ...baseSettings(), vatRatePercent: 120 })).ok).toBe(false);
    expect((await saveShopSettingsCore({ ...baseSettings(), freeShippingFromCents: -1 })).ok).toBe(false);
    const duplicate = baseSettings();
    duplicate.shippingMethods[1]!.key = duplicate.shippingMethods[0]!.key;
    expect((await saveShopSettingsCore(duplicate)).ok).toBe(false);
    const noActive = baseSettings();
    noActive.paymentMethods = noActive.paymentMethods.map((m) => ({ ...m, active: false }));
    expect((await saveShopSettingsCore(noActive)).ok).toBe(false);
    expect((await saveShopSettingsCore(baseSettings())).ok).toBe(true);
  });

  it("an edited VAT rate and shipping price flow through the booked totals", async () => {
    await seedProduct("rates");
    const edited = baseSettings();
    edited.vatRatePercent = 10;
    edited.freeShippingFromCents = 50000;
    edited.shippingMethods = edited.shippingMethods.map((m) =>
      m.key === "standard" ? { ...m, priceCents: 790 } : m,
    );
    expect((await saveShopSettingsCore(edited)).ok).toBe(true);

    const result = await checkout("rates", "standard", "mock");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals.shippingCents).toBe(790);
    expect(result.totals.totalCents).toBe(10790);
    expect(result.totals.vatCents).toBe(computeTotals([{ unitPriceCents: 10000, qty: 1 }], "standard", edited).vatCents);

    const order = await OrderModel.findOne({ orderNumber: result.orderNumber }).lean<Order>().exec();
    expect(order?.payment.kind).toBe("immediate");
    expect(order?.shipping.storePickup).toBe(false);
  });

  it("a payment method added at runtime books a paid order — no code change (done-when)", async () => {
    await seedProduct("twint");
    const withTwint = baseSettings();
    withTwint.paymentMethods = [
      ...withTwint.paymentMethods,
      { key: "twint", label: "Twint (Demo)", position: 4, active: true, kind: "immediate" },
    ];
    expect((await saveShopSettingsCore(withTwint)).ok).toBe(true);

    const result = await checkout("twint", "standard", "twint");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await OrderModel.findOne({ orderNumber: result.orderNumber }).lean<Order>().exec();
    expect(order?.payment.method).toBe("twint");
    expect(order?.payment.kind).toBe("immediate");
    expect(order?.status).toBe("paid");
  });

  it("a disabled or unknown method is refused with nothing written", async () => {
    await seedProduct("disabled");
    const withoutInvoice = baseSettings();
    withoutInvoice.paymentMethods = withoutInvoice.paymentMethods.filter((m) => m.key !== "invoice");
    expect((await saveShopSettingsCore(withoutInvoice)).ok).toBe(true);

    const stockBefore = (await ProductModel.findOne({ slug: "settings-test-disabled" }).lean().exec())!
      .variants[0]!.stock;
    for (const method of ["invoice", "twint"]) {
      const result = await checkout("disabled", "standard", method);
      expect(result.ok).toBe(false);
    }
    const stockAfter = (await ProductModel.findOne({ slug: "settings-test-disabled" }).lean().exec())!
      .variants[0]!.stock;
    expect(stockAfter).toBe(stockBefore);
    expect(await OrderModel.countDocuments()).toBe(2);
  });

  it("kind rules hold server-side: on_pickup needs store pickup, invoice needs delivery", async () => {
    await seedProduct("kinds");
    await saveShopSettingsCore(baseSettings());
    expect((await checkout("kinds", "standard", "pickup")).ok).toBe(false);
    expect((await checkout("kinds", "pickup", "invoice")).ok).toBe(false);

    const onPickup = await checkout("kinds", "pickup", "pickup");
    expect(onPickup.ok).toBe(true);
    if (!onPickup.ok) return;
    const order = await OrderModel.findOne({ orderNumber: onPickup.orderNumber }).lean<Order>().exec();
    expect(order?.shipping.storePickup).toBe(true);
    expect(order?.payment.kind).toBe("on_pickup");
    expect(order?.status).toBe("new");
    expect(order?.shipping.pickup?.code).toBeDefined();
  });

  it("an invoice-kind method added at runtime gets the full invoice flow", async () => {
    await seedProduct("rechnung");
    const userId = (
      await UserModel.create({
        email: "rechnung-config@example.ch",
        name: "Rechnung Person",
        role: "customer",
        passwordHash: await hashPassword("SicheresPasswort1"),
      })
    )._id.toString();
    const withTwintInvoice = baseSettings();
    withTwintInvoice.paymentMethods = [
      ...withTwintInvoice.paymentMethods,
      { key: "twint-rechnung", label: "Twint Rechnung", position: 5, active: true, kind: "invoice" },
    ];
    expect((await saveShopSettingsCore(withTwintInvoice)).ok).toBe(true);

    const result = await checkout("rechnung", "standard", "twint-rechnung", { userId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await OrderModel.findOne({ orderNumber: result.orderNumber }).lean<Order>().exec();
    expect(order?.payment.method).toBe("twint-rechnung");
    expect(order?.payment.kind).toBe("invoice");
    expect(order?.status).toBe("new");
    expect(order?.payment.invoice?.dueAt).toBeDefined();
  });

  it("the seed inserts the settings insert-only — admin edits survive a re-seed (#14)", async () => {
    const edited = baseSettings();
    edited.vatRatePercent = 5;
    await saveShopSettingsCore(edited);
    // #64: the seed returns the STORED settings, so seeded orders compute totals with
    // the rules the shop actually uses — not the defaults.
    const returned = await seedShopSettings();
    expect(returned.vatRatePercent).toBe(5);
    const stored = await ShopSettingsModel.findOne({ key: "shop" }).lean().exec();
    expect(stored?.vatRatePercent).toBe(5);
  });
});
