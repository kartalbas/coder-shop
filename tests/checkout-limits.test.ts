import { describe, expect, it } from "vitest";
import {
  MAX_CHECKOUT_LINES,
  MAX_QTY_PER_LINE,
  MAX_QTY_PER_SKU,
  checkoutSchema,
} from "@/lib/validations/checkout";
import { createRateLimiter } from "@/server/rate-limit";

const customer = {
  name: "Lena Meier",
  email: "lena@example.ch",
  phone: "079 555 01 10",
  street: "Bahnhofstrasse 12",
  postalCode: "8001",
  city: "Zürich",
};

function payload(lines: { sku: string; qty: number }[]) {
  return { lines, customer, shippingMethod: "standard" as const };
}

describe("checkout schema anti-abuse caps (issue #8)", () => {
  it("accepts a normal basket", () => {
    expect(
      checkoutSchema.safeParse(payload([{ sku: "A", qty: 2 }, { sku: "B", qty: MAX_QTY_PER_LINE }]))
        .success,
    ).toBe(true);
  });

  it("rejects a quantity above the per-line cap", () => {
    expect(checkoutSchema.safeParse(payload([{ sku: "A", qty: MAX_QTY_PER_LINE + 1 }])).success)
      .toBe(false);
  });

  it("rejects more lines than the cap", () => {
    const lines = Array.from({ length: MAX_CHECKOUT_LINES + 1 }, (_, i) => ({
      sku: `S-${i}`,
      qty: 1,
    }));
    expect(checkoutSchema.safeParse(payload(lines)).success).toBe(false);
  });

  it("rejects the same SKU split over lines beyond the per-SKU cap", () => {
    const half = Math.ceil(MAX_QTY_PER_SKU / 2);
    const lines = [
      { sku: "A", qty: half },
      { sku: "A", qty: MAX_QTY_PER_SKU - half + 1 },
    ];
    const result = checkoutSchema.safeParse(payload(lines));
    expect(result.success).toBe(false);
  });

  it("allows the same SKU split over lines within the per-SKU cap", () => {
    const lines = [
      { sku: "A", qty: MAX_QTY_PER_SKU - 1 },
      { sku: "A", qty: 1 },
    ];
    expect(checkoutSchema.safeParse(payload(lines)).success).toBe(true);
  });
});

describe("createRateLimiter", () => {
  it("allows maxPerWindow per window, then blocks with a retry hint", () => {
    const limiter = createRateLimiter(3, 60_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(limiter.check("ip", t0).allowed).toBe(true);
    }
    const blocked = limiter.check("ip", t0 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryInSeconds).toBeGreaterThan(0);
  });

  it("windows are per key and reset after the window", () => {
    const limiter = createRateLimiter(1, 10_000);
    const t0 = 2_000_000;
    expect(limiter.check("a", t0).allowed).toBe(true);
    expect(limiter.check("b", t0).allowed).toBe(true);
    expect(limiter.check("a", t0 + 1000).allowed).toBe(false);
    expect(limiter.check("a", t0 + 11_000).allowed).toBe(true);
  });
});
