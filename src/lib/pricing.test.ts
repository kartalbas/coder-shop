import { describe, expect, it } from "vitest";
import {
  buyablePriceCents,
  computeTotals,
  freeShippingProgress,
  shippingCents,
  subtotalCents,
  vatFromGross,
} from "./pricing";
import { DEFAULT_SHOP_SETTINGS, vatLabel, type ShopSettings } from "./shop-settings";

// Issue #64: every rule below is applied over an injected configuration — the same
// settings object the server loads from `shop_settings`.
const settings: ShopSettings = structuredClone(DEFAULT_SHOP_SETTINGS);
const FREE_FROM = settings.freeShippingFromCents;
const priceOf = (key: string) =>
  settings.shippingMethods.find((method) => method.key === key)!.priceCents;

describe("vatFromGross (VAT rounding rule: gross − round(gross × 100 / (100 + rate)))", () => {
  it.each([
    [0, 0],
    [10810, 810],
    [100, 7],
    [108, 8],
    [490, 37],
    [10000, 749],
    [1290, 97],
    [1, 0],
  ])("gross %i cents → vat %i cents at 8.1 %", (gross, vat) => {
    expect(vatFromGross(gross, 8.1)).toBe(vat);
  });

  it("follows the configured rate (issue #64)", () => {
    expect(vatFromGross(11000, 10)).toBe(1000);
    expect(vatFromGross(10000, 0)).toBe(0);
  });
});

describe("subtotal and shipping", () => {
  it("sums unit price × qty", () => {
    expect(subtotalCents([{ unitPriceCents: 1000, qty: 2 }, { unitPriceCents: 500, qty: 3 }])).toBe(
      3500,
    );
  });

  it("empty cart has subtotal 0", () => {
    expect(subtotalCents([])).toBe(0);
  });

  it("standard shipping below the free threshold", () => {
    expect(shippingCents(FREE_FROM - 1, "standard", settings)).toBe(priceOf("standard"));
  });

  it("express shipping below the free threshold", () => {
    expect(shippingCents(0, "express", settings)).toBe(priceOf("express"));
  });

  it("free shipping from the configured threshold", () => {
    expect(shippingCents(FREE_FROM, "standard", settings)).toBe(0);
    expect(shippingCents(FREE_FROM, "express", settings)).toBe(0);
  });

  it("store pickup is always free, below the threshold too", () => {
    expect(shippingCents(0, "pickup", settings)).toBe(0);
  });

  it("an edited price applies immediately — data, not a constant (issue #64)", () => {
    const edited: ShopSettings = {
      ...settings,
      freeShippingFromCents: 20000,
      shippingMethods: settings.shippingMethods.map((method) =>
        method.key === "standard" ? { ...method, priceCents: 790 } : method,
      ),
    };
    expect(shippingCents(10000, "standard", edited)).toBe(790);
    expect(shippingCents(20000, "standard", edited)).toBe(0);
  });
});

describe("computeTotals", () => {
  it("computes consistent totals with shipping", () => {
    const totals = computeTotals([{ unitPriceCents: 5000, qty: 1 }], "standard", settings);
    expect(totals).toEqual({
      subtotalCents: 5000,
      shippingCents: 490,
      discountCents: 0,
      totalCents: 5490,
      vatCents: vatFromGross(5490, settings.vatRatePercent),
    });
  });

  it("a discount reduces the total and the VAT base (issue #45)", () => {
    const totals = computeTotals([{ unitPriceCents: 5000, qty: 1 }], "standard", settings, 1000);
    expect(totals.discountCents).toBe(1000);
    expect(totals.totalCents).toBe(4490);
    expect(totals.vatCents).toBe(vatFromGross(4490, settings.vatRatePercent));
    // Never more than the subtotal.
    expect(
      computeTotals([{ unitPriceCents: 500, qty: 1 }], "standard", settings, 9999).totalCents,
    ).toBe(490);
  });

  it("free shipping applies to the total", () => {
    const totals = computeTotals([{ unitPriceCents: 12000, qty: 1 }], "express", settings);
    expect(totals.shippingCents).toBe(0);
    expect(totals.totalCents).toBe(12000);
  });

  it("vat is derived from the VAT-inclusive total", () => {
    const totals = computeTotals([{ unitPriceCents: 1990, qty: 3 }], "standard", settings);
    expect(totals.vatCents).toBe(
      totals.totalCents - Math.round((totals.totalCents * 100) / (100 + settings.vatRatePercent)),
    );
  });

  it("a configured VAT rate flows through the totals (issue #64)", () => {
    const edited: ShopSettings = { ...settings, vatRatePercent: 10 };
    const totals = computeTotals([{ unitPriceCents: 11000, qty: 1 }], "pickup", edited);
    expect(totals.vatCents).toBe(1000);
  });
});

describe("VAT and free-shipping copy come from the configuration (issues #30/#64)", () => {
  it("vatLabel formats the configured rate with a German comma", () => {
    expect(vatLabel(8.1)).toBe("8,1 % MwSt.");
    expect(vatLabel(10)).toBe("10,0 % MwSt.");
  });

  it("freeShippingProgress counts down to the configured threshold and caps at 100 %", () => {
    expect(freeShippingProgress(0, settings)).toEqual({
      remainingCents: 10000,
      percent: 0,
      reached: false,
    });
    expect(freeShippingProgress(5000, settings)).toEqual({
      remainingCents: 5000,
      percent: 50,
      reached: false,
    });
    expect(freeShippingProgress(10000, settings)).toEqual({
      remainingCents: 0,
      percent: 100,
      reached: true,
    });
    expect(freeShippingProgress(25000, settings)).toEqual({
      remainingCents: 0,
      percent: 100,
      reached: true,
    });
  });
});

describe("buyablePriceCents (issue #20)", () => {
  it("uses the base price when no variant adds anything", () => {
    expect(buyablePriceCents(10000, [0, 0])).toEqual({ priceCents: 10000, from: false });
    expect(buyablePriceCents(10000, [])).toEqual({ priceCents: 10000, from: false });
  });

  it("advertises the cheapest variant price and says „ab“ when others cost more", () => {
    expect(buyablePriceCents(48400, [2000, 4500])).toEqual({ priceCents: 50400, from: true });
    expect(buyablePriceCents(10000, [0, 2000])).toEqual({ priceCents: 10000, from: true });
  });

  it("no „ab“ when every variant costs the same", () => {
    expect(buyablePriceCents(10000, [500, 500])).toEqual({ priceCents: 10500, from: false });
  });
});
