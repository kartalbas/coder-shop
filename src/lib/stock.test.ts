import { describe, expect, it } from "vitest";
import { applyDelta, canFulfill, isLowStock } from "./stock";

describe("canFulfill", () => {
  it.each([
    [5, 5, true],
    [5, 4, true],
    [5, 6, false],
    [5, 0, false],
    [5, -1, false],
    [0, 1, false],
    [0, 0, false],
    [1.5, 1, false],
    [2, 1.5, false],
  ])("stock %i qty %i → %s", (stock, qty, expected) => {
    expect(canFulfill(stock, qty)).toBe(expected);
  });
});

describe("applyDelta", () => {
  it("adds a positive delta", () => {
    expect(applyDelta(10, 5)).toBe(15);
  });

  it("subtracts a negative delta", () => {
    expect(applyDelta(10, -3)).toBe(7);
  });
});

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
