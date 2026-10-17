import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discountForSubtotal, isDiscountInWindow } from "@/lib/discounts";
import { computeTotals, vatFromGross } from "@/lib/pricing";
import { DEFAULT_SHOP_SETTINGS as SETTINGS } from "@/lib/shop-settings";
import { DiscountCodeModel } from "@/models/discount-code";
import { DiscountUsageModel } from "@/models/discount-usage";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { createOrderCore } from "@/server/checkout";
import { checkDiscountCore, createDiscountCore, listDiscountsCore } from "@/server/discounts";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CUSTOMER = {
  name: "Rabatt Person",
  email: "rabatt@example.ch",
  phone: "079 111 22 33",
  street: "Testweg 7",
  postalCode: "8001",
  city: "Zürich",
  country: "CH",
};

describe("discount rules (pure, issue #45)", () => {
  it("percent rounds to cents, fixed applies, both cap at the subtotal", () => {
    expect(discountForSubtotal(10_000, { kind: "percent", percent: 10, minOrderCents: 0 })).toBe(1000);
    expect(discountForSubtotal(999, { kind: "percent", percent: 10, minOrderCents: 0 })).toBe(100); // 99.9 → 100
    expect(discountForSubtotal(994, { kind: "percent", percent: 10, minOrderCents: 0 })).toBe(99);
    expect(discountForSubtotal(20_000, { kind: "fixed", amountCents: 2500, minOrderCents: 0 })).toBe(2500);
    expect(discountForSubtotal(1000, { kind: "fixed", amountCents: 2500, minOrderCents: 0 })).toBe(1000);
  });

  it("zero below the minimum order", () => {
    const def = { kind: "percent" as const, percent: 20, minOrderCents: 5000 };
    expect(discountForSubtotal(4999, def)).toBe(0);
    expect(discountForSubtotal(5000, def)).toBe(1000);
  });

  it("validity window: active flag, from and to", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(isDiscountInWindow({ active: true }, now)).toBe(true);
    expect(isDiscountInWindow({ active: false }, now)).toBe(false);
    expect(isDiscountInWindow({ active: true, validFrom: new Date("2026-10-01") }, now)).toBe(true);
    expect(isDiscountInWindow({ active: true, validFrom: new Date("2026-11-01") }, now)).toBe(false);
    expect(isDiscountInWindow({ active: true, validTo: new Date("2026-10-01") }, now)).toBe(false);
  });

  it("the discount reduces the total and the VAT is computed over the reduced gross", () => {
    const items = [{ unitPriceCents: 10_000, qty: 2 }];
    const plain = computeTotals(items, "standard", SETTINGS);
    const reduced = computeTotals(items, "standard", SETTINGS, 2000);
    expect(plain.totalCents).toBe(20_000); // free shipping above the threshold
    expect(reduced.totalCents).toBe(18_000);
    expect(reduced.vatCents).toBe(vatFromGross(18_000, SETTINGS.vatRatePercent));
    expect(reduced.vatCents).toBeLessThan(plain.vatCents);
    // The discount never exceeds the subtotal.
    expect(computeTotals(items, "standard", SETTINGS, 99_999).totalCents).toBe(0);
  });
});

async function seedProduct(stock: number, tag: string, priceCents = 10_000) {
  await ProductModel.create({
    slug: `disc-${tag}`,
    name: `Rabatt Test ${tag}`,
    description: "Produkt für Rabatt-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/disc-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: {  color: ["schwarz"], size: [], storage: ["128"], material: []  },
    variants: [
      {
        sku: `DC-${tag}`,
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

function checkout(sku: string, qty: number, email = CUSTOMER.email, discountCode?: string) {
  return createOrderCore({
    lines: [{ sku, qty, expectedUnitPriceCents: 10_000 }],
    customer: { ...CUSTOMER, email },
    shippingMethod: "standard",
    ...(discountCode !== undefined && { discountCode }),
  });
}

describe("discount codes in checkout (issue #45)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("a valid code reduces total and VAT and is recorded on the order", async () => {
    await seedProduct(10, "ok");
    expect((await createDiscountCore({ code: "sparen10", kind: "percent", percent: 10, minOrderCents: 0, perCustomerOnce: false })).ok).toBe(true);

    const result = await checkout("DC-ok", 2, CUSTOMER.email, " sparen10 ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals.discountCents).toBe(2000);
    expect(result.totals.totalCents).toBe(18_000);
    expect(result.totals.vatCents).toBe(vatFromGross(18_000, SETTINGS.vatRatePercent));

    const order = await OrderModel.findOne({ orderNumber: result.orderNumber }).lean().exec();
    expect(order?.discount).toEqual({ code: "SPAREN10", cents: 2000 });
    expect(order?.totals.discountCents).toBe(2000);

    const code = await DiscountCodeModel.findOne({ code: "SPAREN10" }).lean().exec();
    expect(code?.usedCount).toBe(1);
  });

  it("stops working at its limits: usage limit, once per customer, window, minimum", async () => {
    await seedProduct(10, "limits");

    // Usage limit 1: the second order with the same (or any) customer is refused.
    await createDiscountCore({ code: "NUR1", kind: "fixed", amountCents: 500, minOrderCents: 0, usageLimit: 1, perCustomerOnce: false });
    expect((await checkout("DC-limits", 1, "erste@example.ch", "NUR1")).ok).toBe(true);
    const second = await checkout("DC-limits", 1, "zweite@example.ch", "NUR1");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("aufgebraucht");

    // Once per customer: first e-mail works, the same e-mail again does not, another does.
    await createDiscountCore({ code: "PRO1", kind: "percent", percent: 5, minOrderCents: 0, perCustomerOnce: true });
    expect((await checkout("DC-limits", 1, "einmal@example.ch", "PRO1")).ok).toBe(true);
    // A different quantity so this is a new submission, not the #15 idempotent replay
    // of the identical one.
    const again = await checkout("DC-limits", 2, "einmal@example.ch", "PRO1");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("bereits verwendet");
    expect((await checkout("DC-limits", 1, "anderer@example.ch", "PRO1")).ok).toBe(true);

    // Expired window and inactive code.
    await DiscountCodeModel.create({
      code: "ALT",
      kind: "percent",
      percent: 50,
      minOrderCents: 0,
      validTo: new Date(Date.now() - 86_400_000),
    });
    const expired = await checkout("DC-limits", 1, "abgelaufen@example.ch", "ALT");
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error).toContain("abgelaufen");

    // Minimum order: 20 % ab 500 CHF on a 200 CHF basket.
    await createDiscountCore({ code: "AB500", kind: "percent", percent: 20, minOrderCents: 50_000, perCustomerOnce: false });
    const tooSmall = await checkout("DC-limits", 2, "mini@example.ch", "AB500");
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.error).toContain("Warenkorb");

    // Unknown code.
    const unknown = await checkout("DC-limits", 1, "unbekannt@example.ch", "GIBTSNICHT");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toContain("ungültig");
  });

  it("a refused code writes no order, no usage and no counter move", async () => {
    await seedProduct(5, "clean");
    await DiscountCodeModel.create({ code: "AUF1", kind: "fixed", amountCents: 100, minOrderCents: 0, usageLimit: 1 });
    expect((await checkout("DC-clean", 1, "erster@example.ch", "AUF1")).ok).toBe(true);
    const orders = await OrderModel.countDocuments();
    const stockBefore = (await ProductModel.findOne({ slug: "disc-clean" }).lean().exec())!.variants[0].stock;

    const refused = await checkout("DC-clean", 1, "zweiter@example.ch", "AUF1");
    expect(refused.ok).toBe(false);
    expect(await OrderModel.countDocuments()).toBe(orders);
    const stockAfter = (await ProductModel.findOne({ slug: "disc-clean" }).lean().exec())!.variants[0].stock;
    expect(stockAfter).toBe(stockBefore);
    expect(await DiscountCodeModel.findOne({ code: "AUF1" }).then((c) => c?.usedCount)).toBe(1);
  });

  it("checkDiscountCore and the admin list report usage statistics", async () => {
    const check = await checkDiscountCore("sparen10", 10_000, "später@example.ch");
    expect(check.ok).toBe(true);
    expect(check.discountCents).toBe(1000);

    const rows = await listDiscountsCore();
    const pro1 = rows.find((row) => row.code === "PRO1");
    expect(pro1?.usedCount).toBe(2);
    expect(pro1?.customerCount).toBe(2);
    const nur1 = rows.find((row) => row.code === "NUR1");
    expect(nur1?.usageLimit).toBe(1);
    // Usage documents (and thus the customer count) only exist for once-per-customer codes.
    expect(nur1?.customerCount).toBe(0);
  });

  it("duplicate codes and bad input are refused", async () => {
    expect((await createDiscountCore({ code: "SPAREN10", kind: "percent", percent: 5, minOrderCents: 0, perCustomerOnce: false })).ok).toBe(false);
    expect((await createDiscountCore({ code: "x", kind: "percent", percent: 5, minOrderCents: 0, perCustomerOnce: false })).ok).toBe(false);
    expect((await createDiscountCore({ code: "OHNEPROZENT", kind: "percent", minOrderCents: 0, perCustomerOnce: false })).ok).toBe(false);
    expect((await createDiscountCore({ code: "VERKEHRTRUM", kind: "fixed", amountCents: 100, minOrderCents: 0, perCustomerOnce: false, validFrom: new Date(), validTo: new Date(Date.now() - 1000) })).ok).toBe(false);
  });

  it("a failed redemption releases everything: corrected resubmit with a valid code works", async () => {
    await seedProduct(5, "retry");
    await DiscountCodeModel.create({ code: "KAPUTT", kind: "percent", percent: 5, minOrderCents: 1_000_000 });
    expect((await checkout("DC-retry", 1, "korrigiert@example.ch", "KAPUTT")).ok).toBe(false);
    // Same cart, valid code: must not be blocked by the failed attempt's idempotency claim.
    expect((await checkout("DC-retry", 1, "korrigiert@example.ch", "SPAREN10")).ok).toBe(true);
    expect(await DiscountUsageModel.countDocuments({ customerKey: "korrigiert@example.ch" })).toBe(0);
  });
});
