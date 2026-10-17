import { describe, expect, it } from "vitest";
import { deriveFilter, type VariantForFacets } from "./facets";

const v = (attributes: VariantForFacets["attributes"]): VariantForFacets => ({ attributes });

describe("deriveFilter", () => {
  it("derives sorted unique colors and ascending storage for smartphones", () => {
    const filter = deriveFilter([
      v({ color: "titan", storage: 256 }),
      v({ color: "schwarz", storage: 128 }),
      v({ color: "titan", storage: 128 }),
      v({ color: "schwarz", storage: 512 }),
    ]);
    expect(filter).toEqual({
      colors: ["schwarz", "titan"],
      sizes: [],
      storage: [128, 256, 512],
      materials: [],
    });
  });

  it("sorts numeric sizes numerically for shoes", () => {
    const filter = deriveFilter([
      v({ color: "schwarz", size: "42" }),
      v({ color: "weiss", size: "36" }),
      v({ color: "schwarz", size: "43" }),
      v({ color: "schwarz", size: "42" }),
    ]);
    expect(filter.sizes).toEqual(["36", "42", "43"]);
  });

  it("sorts clothing sizes in garment order", () => {
    const filter = deriveFilter([
      v({ color: "blau", size: "XL", material: "Baumwolle" }),
      v({ color: "blau", size: "XS", material: "Polyester" }),
      v({ color: "rot", size: "M", material: "Baumwolle" }),
    ]);
    expect(filter.sizes).toEqual(["XS", "M", "XL"]);
    expect(filter.materials).toEqual(["Baumwolle", "Polyester"]);
  });

  it("returns empty arrays for no variants", () => {
    expect(deriveFilter([])).toEqual({ colors: [], sizes: [], storage: [], materials: [] });
  });
});
