import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { firstThreePerTypeBySlug } from "../scripts/seed/demo-content";
import { DEFAULT_CATALOG_TYPES } from "@/lib/catalog-types";
import { isTranslated, needsReview, productContentKeys, typeLabelKey } from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { ProductModel } from "@/models/product";
import { TranslationHistoryModel } from "@/models/translation-history";
import { TranslationModel } from "@/models/translation";
import { getLabels, getTranslations, invalidateI18nCache } from "@/server/i18n";
import { saveCatalogTypeCore } from "@/server/catalog-types";
import { getProductBySlug, toProductDto } from "@/server/search";
import { saveProductContentCore, updateProductCore } from "@/server/products-admin";
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

// Issue #58 step B2: the document is the German truth. A core write that changes a
// German base syncs the **existing** content row through the one validated core (and
// never creates rows); the product form saves per-language texts through
// `saveProductContentCore`, always sending the document's current values as `de`.
// These tests fail without the change: before it, a rename left the row's `de` stale
// and the product form had no write path to the table at all.
describe("German base sync and product content editing (issue #58 step B2)", () => {
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

  async function createProduct(slug: string, name: string, description: string) {
    const created = await ProductModel.create({
      slug,
      name,
      description,
      type: "shoes",
      brand: "Testmarke",
      priceCents: 10_000,
      images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
      featured: false,
      filter: { color: ["schwarz"], size: ["42"], storage: [""], material: [] },
      variants: [
        {
          sku: `B2-${slug}`,
          label: "42 / schwarz",
          priceDeltaCents: 0,
          stock: 5,
          restockThreshold: 3,
          weightGrams: 400,
          attributes: { color: "schwarz", size: "42" },
        },
      ],
    });
    return created._id.toString();
  }

  it("renaming a translated product follows the row's de, keeps the other texts and flags review", async () => {
    const target = demo[0]!;
    const keys = productContentKeys(target.slug);
    const id = await createProduct(target.slug, target.name, target.description);

    const result = await updateProductCore(id, {
      name: "Neuer Name",
      description: target.description,
      brand: target.brand,
      priceCents: target.priceCents,
    });
    expect(result.ok).toBe(true);

    const row = await TranslationModel.findOne({ key: keys.name }).lean().exec();
    expect(row!.de).toBe("Neuer Name");
    // The French text is byte-untouched — only the German base moved.
    const seedRow = DEFAULT_TRANSLATIONS.find((candidate) => candidate.key === keys.name)!;
    expect(row!.texts.fr).toBe(seedRow.texts.fr);
    // The moved base stamp makes the older French text need review, and the sync
    // appended one history entry for `de` (actor null outside a request scope).
    const entries = await getTranslations();
    const entry = entries.find((candidate) => candidate.key === keys.name)!;
    expect(needsReview(entry, "fr")).toBe(true);
    const history = await TranslationHistoryModel.find({ key: keys.name, language: "de" })
      .lean()
      .exec();
    expect(history.some((h) => h.newValue === "Neuer Name" && h.actor === null)).toBe(true);
    // The description row was not touched — its German base did not change.
    const descriptionRow = await TranslationModel.findOne({ key: keys.description })
      .lean()
      .exec();
    expect(descriptionRow!.de).toBe(target.description);
  });

  it("renaming a product without rows creates none (sync, never create)", async () => {
    const id = await createProduct("ohne-zeilen", "Alter Name", "Ein Ausgangstext für den Test.");
    const keys = productContentKeys("ohne-zeilen");

    const result = await updateProductCore(id, {
      name: "Neuer Name",
      description: "Ein neuer Beschreibungstext.",
      brand: "Testmarke",
      priceCents: 10_000,
    });
    expect(result.ok).toBe(true);
    expect(await TranslationModel.countDocuments({ key: { $in: [keys.name, keys.description] } })).toBe(0);
  });

  it("saveProductContentCore creates the rows on demand and the storefront answers French", async () => {
    const id = await createProduct("neu-uebersetzt", "Neu Produkt", "Ein Produkt zum Übersetzen.");
    const keys = productContentKeys("neu-uebersetzt");

    const result = await saveProductContentCore(id, {
      texts: { fr: { name: "Produit nouveau", description: "Un produit à traduire." } },
    });
    expect(result.ok).toBe(true);

    const row = await TranslationModel.findOne({ key: keys.name }).lean().exec();
    expect(row!.area).toBe("catalog");
    expect(row!.de).toBe("Neu Produkt");
    expect(row!.texts.fr).toBe("Produit nouveau");

    const labels = await getLabels("fr");
    const french = await getProductBySlug("neu-uebersetzt", labels);
    expect(french!.name).toBe("Produit nouveau");
    expect(french!.description).toBe("Un produit à traduire.");
    const german = await getProductBySlug("neu-uebersetzt");
    expect(german!.name).toBe("Neu Produkt");
  });

  it("a blank text clears only that code; absent codes stay untouched", async () => {
    const id = await createProduct("loeschen", "Lösch Produkt", "Ein Produkt mit zwei Sprachen.");
    const keys = productContentKeys("loeschen");
    expect(
      (
        await saveProductContentCore(id, {
          texts: {
            fr: { name: "Produit effacé", description: "Un texte." },
            it: { name: "Prodotto cancellato", description: "Un testo." },
          },
        })
      ).ok,
    ).toBe(true);

    expect(
      (
        await saveProductContentCore(id, { texts: { fr: { name: "", description: "Un texte." } } })
      ).ok,
    ).toBe(true);

    const row = await TranslationModel.findOne({ key: keys.name }).lean().exec();
    expect(row!.texts.fr).toBeUndefined();
    expect(row!.texts.it).toBe("Prodotto cancellato");
  });

  it("saveCatalogTypeCore syncs the existing type label row when the label changed", async () => {
    const smartphone = DEFAULT_CATALOG_TYPES.find((type) => type.key === "smartphone")!;
    const key = typeLabelKey("smartphone");
    const stored = await TranslationModel.findOne({ key }).lean().exec();
    expect(stored).not.toBeNull();
    const frBefore = stored!.texts.fr;

    // Creating the configuration is not a rename — the row stays untouched.
    expect((await saveCatalogTypeCore(smartphone)).ok).toBe(true);
    expect((await TranslationModel.findOne({ key }).lean().exec())!.de).toBe(smartphone.label);

    expect((await saveCatalogTypeCore({ ...smartphone, label: "Handys" })).ok).toBe(true);
    const row = await TranslationModel.findOne({ key }).lean().exec();
    expect(row!.de).toBe("Handys");
    expect(row!.texts.fr).toBe(frBefore);

    // An unchanged label moves nothing — no second history entry.
    const historyBefore = await TranslationHistoryModel.countDocuments({ key, language: "de" });
    expect((await saveCatalogTypeCore({ ...smartphone, label: "Handys" })).ok).toBe(true);
    expect(await TranslationHistoryModel.countDocuments({ key, language: "de" })).toBe(historyBefore);
  });
});
