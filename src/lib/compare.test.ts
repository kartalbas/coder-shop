import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_TYPES } from "@/lib/catalog-types";
import type { ProductDto } from "@/lib/dto";
import type { VariantDto } from "@/lib/dto";
import { BASE_LANGUAGE, labelMap } from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { buildComparisonRows, comparableProducts } from "@/lib/compare";

// #58 step 3: the row labels and stock values are table texts — the German map is
// built from the seed itself (byte-identity check, not a fixture).
const DE_LABELS = labelMap(DEFAULT_TRANSLATIONS, BASE_LANGUAGE);

const SMARTPHONE_DIMENSIONS = DEFAULT_CATALOG_TYPES.find((t) => t.key === "smartphone")!.dimensions;
const COMPARABLE = new Set(["smartphone"]);

function variant(overrides: Partial<VariantDto> = {}): VariantDto {
  return {
    sku: "S-1",
    label: "schwarz / 128 GB",
    priceDeltaCents: 0,
    stock: 3,
    restockThreshold: 2,
    weightGrams: 200,
    attributes: { color: "schwarz", storage: "128" },
    ...overrides,
  };
}

function phone(slug: string, overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: slug,
    slug,
    name: `Phone ${slug}`,
    description: "",
    type: "smartphone",
    comparable: true,
    brand: "Apple",
    priceCents: 100_000,
    minPriceCents: 100_000,
    priceFrom: false,
    images: [],
    featured: false,
    collection: null,
    filter: { color: ["schwarz"], storage: ["128"] },
    variants: [variant()],
    rating: { average: 0, count: 0 },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("comparable products (issue #48/#61)", () => {
  it("keeps products of comparable types only and caps at four", () => {
    const shoes = phone("schuh", { type: "shoes", comparable: false });
    const phones = [phone("a"), phone("b"), phone("c"), phone("d"), phone("e")];
    const result = comparableProducts(
      [phones[0]!, shoes, phones[1]!, phones[2]!, phones[3]!, phones[4]!],
      COMPARABLE,
    );
    expect(result.map((product) => product.slug)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("comparison rows (issue #48/#61)", () => {
  it("marks rows where the products differ and only those", () => {
    const a = phone("a");
    const b = phone("b", {
      brand: "Samsung",
      minPriceCents: 90_000,
      filter: { color: ["weiss"], storage: ["256"] },
    });
    const rows = buildComparisonRows([a, b], SMARTPHONE_DIMENSIONS, "de-CH", DE_LABELS);
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    expect(byLabel.get("Marke")?.differs).toBe(true);
    expect(byLabel.get("Preis")?.differs).toBe(true);
    // One row per configured dimension, values formatted with the dimension's unit.
    expect(byLabel.get("Speicher")?.values).toEqual(["128 GB", "256 GB"]);
    expect(byLabel.get("Farbe")?.values).toEqual(["schwarz", "weiss"]);
    // Same weight, same variant count, same availability → not highlighted.
    expect(byLabel.get("Gewicht")?.differs).toBe(false);
    expect(byLabel.get("Gewicht")?.values).toEqual(["200 g", "200 g"]);
    expect(byLabel.get("Varianten")?.differs).toBe(false);
  });

  it("formats price ranges, weight ranges and sold-out stock", () => {
    const cheap = phone("cheap", { minPriceCents: 50_000, priceFrom: true });
    const soldOut = phone("out", { variants: [variant({ stock: 0 })] });
    const heavy = phone("heavy", {
      variants: [variant({ weightGrams: 180 }), variant({ weightGrams: 240 })],
    });
    const rows = buildComparisonRows([cheap, soldOut, heavy], SMARTPHONE_DIMENSIONS, "de-CH", DE_LABELS);
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    expect(byLabel.get("Preis")?.values[0]).toMatch(/^ab CHF\s?500/);
    expect(byLabel.get("Verfügbar")?.values).toEqual(["3 Stück", "Ausverkauft", "6 Stück"]);
    expect(byLabel.get("Gewicht")?.values[2]).toBe("180–240 g");
  });

  // #58 step 3: row labels, the "ab" prefix and the stock value follow the language —
  // fails without the change, which rendered German row labels in every language.
  it("speaks the request language (#58 step 3)", () => {
    const frLabels = labelMap(DEFAULT_TRANSLATIONS, "fr");
    const cheap = phone("cheap", { minPriceCents: 50_000, priceFrom: true });
    const soldOut = phone("out", { variants: [variant({ stock: 0 })] });
    const rows = buildComparisonRows([cheap, soldOut], SMARTPHONE_DIMENSIONS, "fr-CH", frLabels);
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    expect(byLabel.get("Prix")?.values[0]).toMatch(/^dès/);
    expect(byLabel.get("Marque")?.differs).toBe(false);
    expect(byLabel.get("Disponibilité")?.values).toEqual(["3 pièces", "Épuisé"]);
    expect(byLabel.get("Preis")).toBeUndefined();
    // The plural family follows the count: one piece reads its singular row.
    const single = buildComparisonRows(
      [phone("one", { variants: [variant({ stock: 1 })] })],
      SMARTPHONE_DIMENSIONS,
      "fr-CH",
      frLabels,
    );
    expect(new Map(single.map((row) => [row.label, row])).get("Disponibilité")?.values).toEqual([
      "1 pièce",
    ]);
  });
});
