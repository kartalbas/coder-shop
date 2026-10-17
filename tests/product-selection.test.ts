import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_TYPES } from "@/lib/catalog-types";
import {
  dimensionsOf,
  imageIndexForColor,
  matchesSelection,
  missingDimensions,
  slotColor,
  type Selection,
} from "@/lib/product-selection";
import type { ProductDto, VariantDto } from "@/server/search";

const SHOES = DEFAULT_CATALOG_TYPES.find((type) => type.key === "shoes")!;

function variant(sku: string, attributes: Partial<VariantDto["attributes"]>): VariantDto {
  return {
    sku,
    label: sku,
    priceDeltaCents: 0,
    stock: 5,
    restockThreshold: 5,
    weightGrams: 200,
    attributes: { color: "schwarz", ...attributes },
  };
}

function product(variants: VariantDto[]): ProductDto {
  return {
    id: "p1",
    slug: "p",
    name: "P",
    description: "",
    type: "shoes",
    comparable: false,
    brand: "Nike",
    priceCents: 10000,
    minPriceCents: 10000,
    priceFrom: false,
    images: Array.from({ length: 4 }, (_, i) => ({ src: `/products/p-${i + 1}.webp`, alt: "" })),
    featured: false,
    collection: null,
    filter: {},
    variants,
    rating: { average: 0, count: 0 },
    createdAt: new Date().toISOString(),
  };
}

const NOTHING: Selection = {};

describe("missingDimensions (issue #18/#61)", () => {
  const shoes = product([
    variant("A", { color: "grün", size: "39" }),
    variant("B", { color: "grün", size: "42" }),
  ]);

  it("lists every configured dimension of the product that is not chosen", () => {
    expect(missingDimensions(dimensionsOf(shoes, SHOES.dimensions), NOTHING)).toEqual([
      "Farbe",
      "Grösse",
    ]);
  });

  it("is empty once all dimensions are chosen", () => {
    expect(
      missingDimensions(dimensionsOf(shoes, SHOES.dimensions), {
        ...NOTHING,
        color: "grün",
        size: "42",
      }),
    ).toEqual([]);
  });

  it("matchesSelection only finds a variant when nothing contradicts the choice", () => {
    const exact = shoes.variants.find((v) =>
      matchesSelection(v, { ...NOTHING, color: "grün", size: "42" }),
    );
    expect(exact?.sku).toBe("B");
    expect(shoes.variants.find((v) => matchesSelection(v, { ...NOTHING, size: "41" }))).toBeUndefined();
  });

  it("orders values per the dimension's configured order rule", () => {
    const dimensions = dimensionsOf(
      product([
        variant("A", { size: "42" }),
        variant("B", { size: "36" }),
        variant("C", { size: "9" }),
      ]),
      SHOES.dimensions,
    );
    expect(dimensions.find((d) => d.key === "size")?.values).toEqual(["9", "36", "42"]);
  });
});

describe("imageIndexForColor (issue #19)", () => {
  // Slot i shows variant i % count — here: slots grün, blau, grün, blau.
  const variants = [variant("A", { color: "grün" }), variant("B", { color: "blau" })];

  it("picks a slot whose photo shows the chosen colour", () => {
    expect(imageIndexForColor(4, variants, "blau")).toBe(1);
    expect(imageIndexForColor(4, variants, "grün")).toBe(0);
  });

  it("is stable across other dimensions — storage changes do not move the photo", () => {
    expect(imageIndexForColor(4, variants, "blau")).toBe(imageIndexForColor(4, variants, "blau"));
  });

  it("falls back to slot 0 for unknown colours, no colour and no images", () => {
    expect(imageIndexForColor(4, variants, "lila")).toBe(0);
    expect(imageIndexForColor(4, variants, null)).toBe(0);
    expect(imageIndexForColor(0, variants, "blau")).toBe(0);
  });

  it("slotColor mirrors the generator's variant-per-slot rule", () => {
    expect(slotColor(variants, 0)).toBe("grün");
    expect(slotColor(variants, 3)).toBe("blau");
    expect(slotColor([], 0)).toBeUndefined();
  });
});
