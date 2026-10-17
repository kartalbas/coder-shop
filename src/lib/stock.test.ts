import { describe, expect, it } from "vitest";
import { isLowStock, stockLevel } from "./stock";

describe("isLowStock", () => {
  it.each([
    [3, 3, true],
    [2, 3, true],
    [0, 0, true],
    [4, 3, false],
  ])("stock %i threshold %i → %s", (stock, threshold, expected) => {
    expect(isLowStock(stock, threshold)).toBe(expected);
  });
});

describe("stockLevel", () => {
  it("is out at zero or below", () => {
    expect(stockLevel(0, 3)).toBe("out");
    expect(stockLevel(-2, 3)).toBe("out");
  });

  it("is low up to the restock threshold", () => {
    expect(stockLevel(3, 3)).toBe("low");
    expect(stockLevel(1, 3)).toBe("low");
  });

  it("uses a minimum low-stock band of 5 so small thresholds still warn", () => {
    expect(stockLevel(5, 2)).toBe("low");
    expect(stockLevel(6, 2)).toBe("in");
  });

  it("is in above the band", () => {
    expect(stockLevel(10, 3)).toBe("in");
    expect(stockLevel(12, 8)).toBe("in");
  });
});
