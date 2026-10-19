import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateCatalog } from "../scripts/seed/catalog";
import { DEFAULT_CATALOG_TYPES } from "@/lib/catalog-types";
import {
  dimensionLabelKey,
  isTranslated,
  needsReview,
  typeLabelKey,
  valueLabelKey,
} from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { ProductModel } from "@/models/product";
import { getLabels, invalidateI18nCache } from "@/server/i18n";
import { searchProducts, toProductDto } from "@/server/search";
import { seedTranslations } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step B1b: the catalog structure — type labels, dimension captions and
// attribute values — joins the one translation table. The rows are derived from the
// same data the storefront reads (the type configuration and the seed generator), so a
// configuration or generator change fails here loudly instead of silently diverging.

const structureKeys = [
  ...DEFAULT_CATALOG_TYPES.map((type) => typeLabelKey(type.key)),
  ...[
    ...new Map(
      DEFAULT_CATALOG_TYPES.flatMap((type) =>
        type.dimensions.map((dimension) => [dimension.key, dimensionLabelKey(dimension.key)]),
      ),
    ).values(),
  ],
  ...[
    ...new Set(
      generateCatalog().flatMap((product) =>
        product.variants
          .map((variant) => variant.attributes.color)
          .filter((color) => color !== undefined)
          .map((color) => valueLabelKey("color", String(color))),
      ),
    ),
  ],
  ...[
    ...new Set(
      generateCatalog().flatMap((product) =>
        product.variants
          .map((variant) => variant.attributes.material)
          .filter((material) => material !== undefined)
          .map((material) => valueLabelKey("material", String(material))),
      ),
    ),
  ],
];

const structureRows = DEFAULT_TRANSLATIONS.filter(
  (row) =>
    row.key.startsWith("catalog.type.") ||
    row.key.startsWith("catalog.dimension.") ||
    row.key.startsWith("catalog.value."),
);

describe("catalog structure rows (issue #58 step B1b)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedTranslations();
    invalidateI18nCache();
  });

  afterAll(async () => {
    await clearCollections();
    invalidateI18nCache();
    await disconnectTestDB();
  });

  it("the seed carries exactly the derived structure set, translated in every language", () => {
    expect(structureRows.map((row) => row.key).sort()).toEqual([...structureKeys].sort());
    for (const row of structureRows) {
      expect(row.area).toBe("catalog");
      for (const code of ["de", "fr", "it", "rm", "es"]) {
        expect(isTranslated(row, code), `${row.key} in ${code}`).toBe(true);
      }
    }
  });

  it("the German bases are byte-identical to the configuration and the generator", () => {
    for (const type of DEFAULT_CATALOG_TYPES) {
      const row = structureRows.find((row) => row.key === typeLabelKey(type.key))!;
      expect(row.de, type.key).toBe(type.label);
      for (const dimension of type.dimensions) {
        const dimensionRow = structureRows.find(
          (row) => row.key === dimensionLabelKey(dimension.key),
        )!;
        expect(dimensionRow.de, dimension.key).toBe(dimension.label);
      }
    }
    const colors = new Set(
      generateCatalog().flatMap((product) =>
        product.variants
          .map((variant) => variant.attributes.color)
          .filter((color) => color !== undefined)
          .map(String),
      ),
    );
    for (const color of colors) {
      const row = structureRows.find((row) => row.key === valueLabelKey("color", color))!;
      expect(row.de, color).toBe(color);
    }
    const materials = new Set(
      generateCatalog().flatMap((product) =>
        product.variants
          .map((variant) => variant.attributes.material)
          .filter((material) => material !== undefined)
          .map(String),
      ),
    );
    for (const material of materials) {
      const row = structureRows.find((row) => row.key === valueLabelKey("material", material))!;
      expect(row.de, material).toBe(material);
    }
  });

  it("the machine texts are stamped in the past, so the review rule flags them", async () => {
    const { getTranslations } = await import("@/server/i18n");
    const entries = await getTranslations();
    for (const key of structureKeys) {
      const entry = entries.find((row) => row.key === key)!;
      for (const code of ["fr", "it", "rm", "es"]) {
        expect(needsReview(entry, code), `${key} in ${code}`).toBe(true);
      }
      expect(needsReview(entry, "de")).toBe(false);
    }
  });
});

describe("structure resolution at the DTO and search boundary (issue #58 step B1b)", () => {
  const smartphone = DEFAULT_CATALOG_TYPES.find((type) => type.key === "smartphone")!;

  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedTranslations();
    invalidateI18nCache();
    await ProductModel.create({
      slug: "apfel-test-phone-001",
      name: "Apfel Test Phone",
      description: "Ein Test-Smartphone.",
      type: "smartphone",
      brand: "Apfel",
      priceCents: 100_000,
      images: [{ src: "/products/apfel-test-phone-001-1.webp", alt: "Test" }],
      featured: false,
      filter: { color: ["schwarz"], storage: ["256"] },
      variants: [
        {
          sku: "TEST-SP-1",
          label: "schwarz / 256 GB",
          priceDeltaCents: 0,
          stock: 5,
          restockThreshold: 3,
          weightGrams: 200,
          attributes: { color: "schwarz", storage: "256" },
        },
      ],
    });
  });

  afterAll(async () => {
    await clearCollections();
    invalidateI18nCache();
    await disconnectTestDB();
  });

  it("toProductDto recomposes French variant labels with a map, German without", async () => {
    const labels = await getLabels("fr");
    const doc = await ProductModel.findOne({ slug: "apfel-test-phone-001" }).lean().exec();
    const german = toProductDto(doc!);
    expect(german.variants[0]!.label).toBe("schwarz / 256 GB");
    const french = toProductDto(doc!, false, labels, smartphone.dimensions);
    expect(french.variants[0]!.label).toBe("noir / 256 GB");
    // Without the type's dimensions the stored German label stays (admin/API shape).
    expect(toProductDto(doc!, false, labels).variants[0]!.label).toBe("schwarz / 256 GB");
  });

  it("search hits answer in the request language while matching stays German", async () => {
    const labels = await getLabels("fr");
    const [german, french] = await Promise.all([
      searchProducts("Test Phone"),
      searchProducts("Test Phone", 8, labels),
    ]);
    expect(german[0]!.name).toBe("Apfel Test Phone");
    expect(german[0]!.variantHint).toBe("schwarz / 256 GB");
    expect(french[0]!.name).toBe("Apfel Test Phone"); // no content row → German base
    expect(french[0]!.variantHint).toBe("noir / 256 GB");
    // Matching runs on the stored German name — a French word finds nothing.
    expect(await searchProducts("noir", 8, labels)).toEqual([]);
  });
});
