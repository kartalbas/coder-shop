import { describe, expect, it } from "vitest";
import { generateCatalog } from "../scripts/seed/catalog";
import { menuCategories } from "@/lib/menu";

const catalog = generateCatalog();
// Issue #61: the menu categories (and their brands) are the catalog type
// configuration — this test keeps the seed's model tables in step with it.
const categories = menuCategories();
const brandsByType = new Map<string, Set<string>>();
for (const product of catalog) {
  if (!brandsByType.has(product.type)) brandsByType.set(product.type, new Set());
  brandsByType.get(product.type)!.add(product.brand);
}

describe("mega-menu brands (M6/#61)", () => {
  it("covers the configured product types", () => {
    expect(categories.map((c) => c.type).sort()).toEqual(["clothing", "shoes", "smartphone"]);
  });

  it("lists only brands that have products in the seeded catalog", () => {
    for (const category of categories) {
      const catalogBrands = brandsByType.get(category.type);
      expect(catalogBrands, `no catalog brands for ${category.type}`).toBeDefined();
      for (const brand of category.brands) {
        expect(
          catalogBrands!.has(brand),
          `mega-menu brand "${brand}" (${category.type}) has no seeded products`,
        ).toBe(true);
      }
    }
  });

  it("lists every catalog brand of every type", () => {
    for (const category of categories) {
      const catalogBrands = [...brandsByType.get(category.type)!].sort();
      expect([...category.brands].sort()).toEqual(catalogBrands);
    }
  });
});
