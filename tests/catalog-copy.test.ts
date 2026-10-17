import { describe, expect, it } from "vitest";
import { describe as describeProduct, generateCatalog } from "../scripts/seed/catalog";
import { stockLabel } from "@/lib/stock";

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

describe("stockLabel (issue #28)", () => {
  it("keeps the Swiss plural „Stück“ for every count", () => {
    expect(stockLabel("low", 1)).toBe("Nur noch 1 Stück");
    expect(stockLabel("low", 3)).toBe("Nur noch 3 Stück");
    expect(stockLabel("low", 17)).toBe("Nur noch 17 Stück");
    expect(stockLabel("in", 50)).toBe("Sofort lieferbar");
    expect(stockLabel("out", 0)).toBe("Ausverkauft");
  });
});
