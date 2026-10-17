import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_TYPES } from "./catalog-types";
import { deriveFilter, type VariantForFacets } from "./facets";

const v = (attributes: VariantForFacets["attributes"]): VariantForFacets => ({ attributes });

const dimensionsOf = (key: string) =>
  DEFAULT_CATALOG_TYPES.find((type) => type.key === key)!.dimensions;

describe("deriveFilter (issue #61: dimensions from the catalog configuration)", () => {
  it("derives sorted unique colors and ascending storage for smartphones", () => {
    const filter = deriveFilter(
      [
        v({ color: "titan", storage: 256 }),
        v({ color: "schwarz", storage: 128 }),
        v({ color: "titan", storage: 128 }),
        v({ color: "schwarz", storage: 512 }),
      ],
      dimensionsOf("smartphone"),
    );
    expect(filter).toEqual({
      color: ["schwarz", "titan"],
      storage: ["128", "256", "512"],
    });
  });

  it("sorts numeric sizes numerically for shoes", () => {
    const filter = deriveFilter(
      [
        v({ color: "schwarz", size: "42" }),
        v({ color: "weiss", size: "36" }),
        v({ color: "schwarz", size: "43" }),
        v({ color: "schwarz", size: "42" }),
      ],
      dimensionsOf("shoes"),
    );
    expect(filter.size).toEqual(["36", "42", "43"]);
  });

  it("sorts clothing sizes in garment order", () => {
    const filter = deriveFilter(
      [
        v({ color: "blau", size: "XL", material: "Baumwolle" }),
        v({ color: "blau", size: "XS", material: "Polyester" }),
        v({ color: "rot", size: "M", material: "Baumwolle" }),
      ],
      dimensionsOf("clothing"),
    );
    expect(filter.size).toEqual(["XS", "M", "XL"]);
    expect(filter.material).toEqual(["Baumwolle", "Polyester"]);
  });

  it("returns an empty filter for no variants", () => {
    expect(deriveFilter([], dimensionsOf("smartphone"))).toEqual({});
  });

  it("only derives the dimensions the configuration declares", () => {
    const filter = deriveFilter([v({ color: "rot", size: "M" })], dimensionsOf("smartphone"));
    expect(filter).toEqual({ color: ["rot"] });
  });
});
