import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  arrivalBucket,
  expectedArrival,
  incomingForLines,
  incomingLabel,
} from "./incoming";

const NOW = new Date("2026-03-10T08:00:00Z");

describe("expectedArrival", () => {
  it("adds the supplier lead time to the order date", () => {
    expect(expectedArrival(NOW, 7).getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    expect(expectedArrival(NOW, 0)).toEqual(NOW);
    expect(expectedArrival(NOW, -3)).toEqual(NOW);
  });
});

describe("incomingForLines", () => {
  it("sums the open quantity per sku and keeps the earliest arrival", () => {
    const arrivalLate = new Date(NOW.getTime() + 9 * DAY_MS);
    const arrivalSoon = new Date(NOW.getTime() + 2 * DAY_MS);
    const map = incomingForLines([
      { sku: "A", qty: 5, received: 2, arrival: arrivalLate },
      { sku: "A", qty: 4, received: 0, arrival: arrivalSoon },
      { sku: "B", qty: 3, received: 3, arrival: arrivalSoon },
      { sku: "C", qty: 2, received: 0 },
    ]);
    expect(map.get("A")).toEqual({ qty: 7, arrival: arrivalSoon });
    expect(map.has("B")).toBe(false);
    expect(map.get("C")?.qty).toBe(2);
  });

  it("is empty when nothing is open", () => {
    expect(incomingForLines([{ sku: "A", qty: 5, received: 5 }]).size).toBe(0);
  });
});

describe("arrivalBucket / incomingLabel", () => {
  it("phrases the German buckets", () => {
    expect(arrivalBucket(new Date(NOW.getTime() - DAY_MS), NOW)).toBe("heute");
    expect(arrivalBucket(NOW, NOW)).toBe("heute");
    expect(arrivalBucket(new Date(NOW.getTime() + DAY_MS), NOW)).toBe("morgen");
    expect(arrivalBucket(new Date(NOW.getTime() + 3 * DAY_MS), NOW)).toBe("in 3 Tagen");
    expect(arrivalBucket(new Date(NOW.getTime() + 7 * DAY_MS), NOW)).toBe("in 7 Tagen");
    expect(arrivalBucket(new Date(NOW.getTime() + 10 * DAY_MS), NOW)).toBe("in 2 Wochen");
    expect(arrivalBucket(new Date(NOW.getTime() + 20 * DAY_MS), NOW)).toBe("in 3 Wochen");
  });

  it("combines quantity and bucket", () => {
    expect(incomingLabel(5, new Date(NOW.getTime() + 3 * DAY_MS), NOW)).toBe(
      "5 Stk. bestellt, Ankunft ca. in 3 Tagen",
    );
  });
});
