import { describe, expect, it } from "vitest";
import {
  VAT_INCLUSIVE_NOTE,
  VAT_LABEL,
  buyablePriceCents,
  freeShippingProgress,
  FREE_SHIPPING_FROM_CENTS,
  SHIPPING_CENTS,
  computeTotals,
  shippingCents,
  subtotalCents,
  vatFromGross,
} from "./pricing";

describe("vatFromGross (VAT rounding rule: gross − round(gross × 100 / 108.1))", () => {
  it.each([
    [0, 0],
    [10810, 810],
    [100, 7],
    [108, 8],
    [490, 37],
    [10000, 749],
    [1290, 97],
    [1, 0],
  ])("gross %i cents → vat %i cents", (gross, vat) => {
    expect(vatFromGross(gross)).toBe(vat);
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
    expect(shippingCents(FREE_SHIPPING_FROM_CENTS - 1, "standard")).toBe(SHIPPING_CENTS.standard);
  });

  it("express shipping below the free threshold", () => {
    expect(shippingCents(0, "express")).toBe(SHIPPING_CENTS.express);
  });

  it("free shipping from CHF 100 subtotal", () => {
    expect(shippingCents(FREE_SHIPPING_FROM_CENTS, "standard")).toBe(0);
    expect(shippingCents(FREE_SHIPPING_FROM_CENTS, "express")).toBe(0);
  });
});

describe("computeTotals", () => {
  it("computes consistent totals with shipping", () => {
    const totals = computeTotals([{ unitPriceCents: 5000, qty: 1 }], "standard");
    expect(totals).toEqual({
      subtotalCents: 5000,
      shippingCents: 490,
      totalCents: 5490,
      vatCents: vatFromGross(5490),
    });
  });

  it("free shipping applies to the total", () => {
    const totals = computeTotals([{ unitPriceCents: 12000, qty: 1 }], "express");
    expect(totals.shippingCents).toBe(0);
    expect(totals.totalCents).toBe(12000);
  });

  it("vat is derived from the VAT-inclusive total", () => {
    const totals = computeTotals([{ unitPriceCents: 1990, qty: 3 }], "standard");
    expect(totals.vatCents).toBe(totals.totalCents - Math.round((totals.totalCents * 100) / 108.1));
  });
});

describe("VAT and free-shipping copy come from the rules (issue #30)", () => {
  it("VAT_LABEL is derived from VAT_RATE_PERCENT with a German comma", () => {
    expect(VAT_LABEL).toBe("8,1 % MwSt.");
    expect(VAT_INCLUSIVE_NOTE).toBe("8,1 % MwSt. inbegriffen");
  });

  it("freeShippingProgress counts down to the threshold and caps at 100 %", () => {
    expect(freeShippingProgress(0)).toEqual({ remainingCents: 10000, percent: 0, reached: false });
    expect(freeShippingProgress(5000)).toEqual({
      remainingCents: 5000,
      percent: 50,
      reached: false,
    });
    expect(freeShippingProgress(10000)).toEqual({
      remainingCents: 0,
      percent: 100,
      reached: true,
    });
    expect(freeShippingProgress(25000)).toEqual({
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
