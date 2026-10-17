import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/lib/orders/state-machine";
import { aggregateRating, countsAsPurchase } from "@/lib/reviews";

describe("rating aggregate (issue #47)", () => {
  it("is empty for no ratings", () => {
    expect(aggregateRating([])).toEqual({ average: 0, count: 0, distribution: [0, 0, 0, 0, 0] });
  });

  it("averages to one decimal and counts the star distribution", () => {
    const result = aggregateRating([5, 4, 4, 3, 1]);
    expect(result.count).toBe(5);
    expect(result.average).toBe(3.4);
    expect(result.distribution).toEqual([1, 0, 1, 2, 1]);
  });

  it("ignores values outside 1–5", () => {
    const result = aggregateRating([5, 0, 6, 2.5, 4]);
    expect(result.count).toBe(2);
    expect(result.average).toBe(4.5);
  });
});

describe("purchase rule (issue #47)", () => {
  it("counts every real purchase, not new and not cancelled", () => {
    for (const status of ORDER_STATUSES) {
      expect(countsAsPurchase(status)).toBe(status !== "new" && status !== "cancelled");
    }
  });
});
