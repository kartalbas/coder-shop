import { describe, expect, it } from "vitest";
import { compareFacetValues, isNumericFacetValue } from "@/lib/facet-order";

describe("compareFacetValues", () => {
  it("orders clothing sizes by garment size, not alphabetically (issue #24)", () => {
    const sizes = ["XXL", "L", "XS", "M", "S", "XL"];
    expect([...sizes].sort(compareFacetValues)).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
  });

  it("orders EU sizes and storage numerically", () => {
    const sizes = ["47", "9", "36", "100", "42"];
    expect([...sizes].sort(compareFacetValues)).toEqual(["9", "36", "42", "47", "100"]);
  });

  it("puts numbers before size tokens before other strings", () => {
    const values = ["Baumwolle", "42", "M", "36", "Kunstfaser", "XS"];
    expect([...values].sort(compareFacetValues)).toEqual([
      "36",
      "42",
      "XS",
      "M",
      "Baumwolle",
      "Kunstfaser",
    ]);
  });

  it("detects numeric facet values", () => {
    expect(isNumericFacetValue("42")).toBe(true);
    expect(isNumericFacetValue("XS")).toBe(false);
    expect(isNumericFacetValue("12.5")).toBe(false);
  });
});
