import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { firstThreePerTypeBySlug } from "../scripts/seed/demo-content";
import { isTranslated, needsReview, productContentKeys } from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { ProductModel } from "@/models/product";
import { TranslationModel } from "@/models/translation";
import { getLabels, getTranslations, invalidateI18nCache } from "@/server/i18n";
import { getProductBySlug, toProductDto } from "@/server/search";
import { seedTranslations } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step B1a: product names and descriptions are rows of the one translation
// table, resolved at the DTO boundary in the request language. The stored document
// stays the German base; the demo set is derived from the seed's own catalog
// generator — the first three products per type by slug — so a generator change fails
// here loudly instead of silently diverging from the seeded rows.

const demo = firstThreePerTypeBySlug();
const demoKeys = demo.flatMap((product) => {
  const keys = productContentKeys(product.slug);
  return [keys.name, keys.description];
});

// A demo product whose French name differs from the German base — the resolution is
// then visible in the name, not only in the description.
const translated = demo.find((product) => {
  const row = DEFAULT_TRANSLATIONS.find(
    (candidate) => candidate.key === productContentKeys(product.slug).name,
  )!;
  return row.texts.fr !== product.name;
})!;

async function seedTestProduct(slug: string) {
  await ProductModel.create({
    slug,
    name: "Test Produkt",
    description: "Ein Testprodukt für die DTO-Auflösung.",
    type: "shoes",
    brand: "Testmarke",
    priceCents: 10_000,
    images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { color: ["schwarz"], size: ["42"], storage: [""], material: [] },
    variants: [
      {
        sku: `CC-${slug}`,
        label: "42 / schwarz",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 400,
        attributes: { color: "schwarz", size: "42" },
      },
    ],
  });
}

describe("catalog content rows (issue #58 step B1a)", () => {
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

  it("the seed carries exactly the derived demo set, translated in every language", () => {
    const contentRows = DEFAULT_TRANSLATIONS.filter((row) =>
      row.key.startsWith("catalog.product."),
    );
    expect(contentRows.map((row) => row.key).sort()).toEqual([...demoKeys].sort());
    for (const row of contentRows) {
      expect(row.area).toBe("catalog");
      for (const code of ["de", "fr", "it", "rm", "es"]) {
        expect(isTranslated(row, code), `${row.key} in ${code}`).toBe(true);
      }
    }
  });

  it("the German bases are byte-identical to the generator documents", () => {
    for (const product of demo) {
      const keys = productContentKeys(product.slug);
      const name = DEFAULT_TRANSLATIONS.find((row) => row.key === keys.name)!;
      const description = DEFAULT_TRANSLATIONS.find((row) => row.key === keys.description)!;
      expect(name.de).toBe(product.name);
      expect(description.de).toBe(product.description);
    }
  });

  it("the machine texts are stamped in the past, so the review rule flags them", async () => {
    const entries = await getTranslations();
    for (const key of demoKeys) {
      const entry = entries.find((row) => row.key === key)!;
      for (const code of ["fr", "it", "rm", "es"]) {
        expect(needsReview(entry, code), `${key} in ${code}`).toBe(true);
      }
      expect(needsReview(entry, "de")).toBe(false);
    }
  });

  it("a re-seed changes nothing (insert-only)", async () => {
    const content = (docs: { key: string; de: string; texts: unknown; textUpdatedAt: unknown }[]) =>
      docs.map((doc) => ({
        key: doc.key,
        de: doc.de,
        texts: doc.texts,
        textUpdatedAt: doc.textUpdatedAt,
      }));
    const query = () =>
      TranslationModel.find({ key: { $in: demoKeys } }).sort({ key: 1 }).lean().exec();
    const before = content(await query());
    await seedTranslations();
    expect(content(await query())).toEqual(before);
  });
});

describe("content resolution at the DTO boundary (issue #58 step B1a)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedTranslations();
    invalidateI18nCache();
    await seedTestProduct("test-produkt");
    await ProductModel.create({
      slug: translated.slug,
      name: translated.name,
      description: translated.description,
      type: translated.type,
      brand: translated.brand,
      priceCents: 10_000,
      images: [{ src: `/products/${translated.slug}-1.webp`, alt: "Demo" }],
      featured: false,
      filter: translated.filter,
      variants: [
        {
          sku: `CC-${translated.slug}`,
          label: "Demo",
          priceDeltaCents: 0,
          stock: 5,
          restockThreshold: 3,
          weightGrams: 400,
          attributes: {},
        },
      ],
    });
  });

  afterAll(async () => {
    await clearCollections();
    invalidateI18nCache();
    await disconnectTestDB();
  });

  it("toProductDto resolves name and description with a label map, German without", async () => {
    const doc = await ProductModel.findOne({ slug: "test-produkt" }).lean().exec();
    const german = toProductDto(doc!);
    expect(german.name).toBe("Test Produkt");
    expect(german.description).toBe("Ein Testprodukt für die DTO-Auflösung.");
    const keys = productContentKeys("test-produkt");
    const french = toProductDto(doc!, false, {
      [keys.name]: "Produit de test",
      [keys.description]: "Un produit de test.",
    });
    expect(french.name).toBe("Produit de test");
    expect(french.description).toBe("Un produit de test.");
  });

  it("getProductBySlug answers French for a demo product, German for an unseeded one", async () => {
    const labels = await getLabels("fr");
    const seeded = await getProductBySlug(translated.slug, labels);
    const keys = productContentKeys(translated.slug);
    expect(seeded!.name).toBe(labels[keys.name]);
    expect(seeded!.description).toBe(labels[keys.description]);
    expect(seeded!.name).not.toBe(translated.name);
    const unseeded = await getProductBySlug("test-produkt", labels);
    expect(unseeded!.name).toBe("Test Produkt");
    expect(unseeded!.description).toBe("Ein Testprodukt für die DTO-Auflösung.");
  });
});
