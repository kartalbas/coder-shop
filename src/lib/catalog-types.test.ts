import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATALOG_TYPES,
  formatLocalizedDimensionValue,
  localizeCatalogTypes,
  localizeDimensions,
  variantLabel,
} from "@/lib/catalog-types";
import { dimensionLabelKey, typeLabelKey, valueLabelKey } from "@/lib/i18n";

// Issue #58 step B1b: the catalog structure (type labels, dimension captions, attribute
// values, composed variant labels) resolves through the one translation table — with a
// label map, without one everything stays the stored German by construction.

const smartphone = DEFAULT_CATALOG_TYPES.find((type) => type.key === "smartphone")!;
const color = smartphone.dimensions.find((dimension) => dimension.key === "color")!;
const storage = smartphone.dimensions.find((dimension) => dimension.key === "storage")!;

const french = {
  [typeLabelKey("smartphone")]: "Smartphones",
  [typeLabelKey("shoes")]: "Chaussures",
  [dimensionLabelKey("color")]: "Couleur",
  [dimensionLabelKey("storage")]: "Mémoire",
  [valueLabelKey("color", "schwarz")]: "noir",
};

describe("localizeCatalogTypes (#58 step B1b)", () => {
  it("without a label map the configuration is German by construction", () => {
    const types = localizeCatalogTypes(DEFAULT_CATALOG_TYPES);
    expect(types.map((type) => type.label)).toEqual(
      DEFAULT_CATALOG_TYPES.map((type) => type.label),
    );
    expect(types.find((type) => type.key === "shoes")?.label).toBe("Schuhe");
  });

  it("a label map resolves type and dimension labels, machine values stay", () => {
    const types = localizeCatalogTypes(DEFAULT_CATALOG_TYPES, french);
    const shoes = types.find((type) => type.key === "shoes")!;
    expect(shoes.label).toBe("Chaussures");
    expect(shoes.key).toBe("shoes");
    const smartphoneLocalized = types.find((type) => type.key === "smartphone")!;
    expect(smartphoneLocalized.dimensions.map((d) => d.label)).toEqual(["Couleur", "Mémoire"]);
    expect(smartphoneLocalized.dimensions.map((d) => d.key)).toEqual(["color", "storage"]);
    expect(smartphoneLocalized.brands).toEqual(smartphone.brands);
  });

  it("a type without rows keeps its configured German label (the fallback)", () => {
    const types = localizeCatalogTypes(DEFAULT_CATALOG_TYPES, french);
    expect(types.find((type) => type.key === "clothing")?.label).toBe("Kleidung");
  });

  it("localizeDimensions resolves bare dimension lists the same way", () => {
    const dimensions = localizeDimensions([color, storage], french);
    expect(dimensions.map((d) => d.label)).toEqual(["Couleur", "Mémoire"]);
    expect(dimensions[1].unit).toBe("GB");
  });
});

describe("variantLabel and formatLocalizedDimensionValue (#58 step B1b)", () => {
  const attributes = { color: "schwarz", storage: "256" };

  it("the German composition is the stored convention (order, unit, joiner)", () => {
    expect(variantLabel(smartphone.dimensions, attributes)).toBe("schwarz / 256 GB");
    expect(formatLocalizedDimensionValue(storage, "256")).toBe("256 GB");
  });

  it("with a content map every value resolves first, the unit stays", () => {
    expect(variantLabel(smartphone.dimensions, attributes, french)).toBe("noir / 256 GB");
    expect(formatLocalizedDimensionValue(color, "schwarz", french)).toBe("noir");
  });

  it("values without rows stay the value itself (sizes, GB counts)", () => {
    expect(formatLocalizedDimensionValue(storage, "256", french)).toBe("256 GB");
    expect(variantLabel([color], { color: "oliv" }, french)).toBe("oliv");
  });
});
