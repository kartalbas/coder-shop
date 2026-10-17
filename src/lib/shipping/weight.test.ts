import { describe, expect, it } from "vitest";
import { PACKAGING_GRAMS, parcelWeightGrams } from "./weight";

describe("parcelWeightGrams", () => {
  it("exposes the packaging constant of 150 g", () => {
    expect(PACKAGING_GRAMS).toBe(150);
  });

  it("an empty parcel still weighs the packaging", () => {
    expect(parcelWeightGrams([])).toBe(150);
  });

  it("sums qty × weight and adds packaging", () => {
    expect(
      parcelWeightGrams([
        { qty: 2, weightGrams: 300 },
        { qty: 1, weightGrams: 200 },
      ]),
    ).toBe(950);
  });

  it("handles a single line", () => {
    expect(parcelWeightGrams([{ qty: 3, weightGrams: 50 }])).toBe(300);
  });
});
