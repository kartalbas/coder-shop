import { describe, expect, it } from "vitest";
import { describe as describeProduct, generateCatalog } from "../scripts/seed/catalog";
import { BASE_LANGUAGE, interpolate, labelMap, plural } from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";

const DE = labelMap(DEFAULT_TRANSLATIONS, BASE_LANGUAGE);

// Issue #28: the seed used to append declension endings to adjectives that already
// carried one („hochwertige“ + „er“ → „hochwertigeer“).
describe("seed product descriptions (issue #28)", () => {
  const types = ["smartphone", "shoes", "clothing"] as const;

  it("never doubles the e when declining the adjective", () => {
    for (const type of types) {
      for (let i = 0; i < 100; i++) {
        const text = describeProduct(() => i / 100, "Test Produkt", type);
        expect(text).not.toMatch(/[a-zäöü]eer\b|[a-zäöü]ees\b|[a-zäöü]ee \p{L}/u);
      }
    }
  });

  it("declines each adjective correctly per gender", () => {
    const stems = ["hochwertig", "vielseitig", "modern", "robust", "leicht"];
    for (const [i, stem] of stems.entries()) {
      const rng = () => i / stems.length;
      expect(describeProduct(rng, "X", "smartphone")).toContain(`ein ${stem}es Smartphone`);
      expect(describeProduct(rng, "X", "shoes")).toContain(`ein ${stem}er Schuh`);
      expect(describeProduct(rng, "X", "clothing")).toContain(`eine ${stem}e Kleidung`);
    }
  });

  it("uses Swiss spelling everywhere in the generated catalog", () => {
    const catalog = generateCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    for (const product of catalog) {
      expect(product.description).not.toMatch(/ß|Stücke/);
      for (const variant of product.variants) {
        expect(variant.attributes.color ?? "").not.toMatch(/ß/);
        expect(variant.label).not.toMatch(/ß/);
      }
    }
  });
});

// The stock sentence moved into the translation table (#58 step 3); the Swiss plural
// rule (#28) now lives in the German base text of the key.
describe("stock copy in the translation table (issues #28/#58)", () => {
  it("keeps the Swiss plural „Stück“ for every count", () => {
    for (const stock of [1, 3, 17]) {
      expect(interpolate(plural(DE, stock, "shop.stock.low", "de-CH"), { stock })).toBe(
        `Nur noch ${stock} Stück`,
      );
    }
    expect(DE["shop.stock.in"]).toBe("Sofort lieferbar");
    expect(DE["shop.state.soldOut"]).toBe("Ausverkauft");
  });
});
