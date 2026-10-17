import { describe, expect, it } from "vitest";
import { generateCatalog } from "../scripts/seed/catalog";
import { MENU_CATEGORIES } from "@/lib/menu";
import type { ProductType } from "@/models/product";

const catalog = generateCatalog();
const brandsByType = new Map<ProductType, Set<string>>();
for (const product of catalog) {
  if (!brandsByType.has(product.type)) brandsByType.set(product.type, new Set());
  brandsByType.get(product.type)!.add(product.brand);
}

describe("mega-menu brands (M6)", () => {
  it("covers all three product types", () => {
    expect(MENU_CATEGORIES.map((c) => c.type).sort()).toEqual([
      "clothing",
      "shoes",
      "smartphone",
    ]);
  });

  it("lists only brands that have products in the seeded catalog", () => {
    for (const category of MENU_CATEGORIES) {
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
    for (const category of MENU_CATEGORIES) {
      const catalogBrands = [...brandsByType.get(category.type)!].sort();
      expect([...category.brands].sort()).toEqual(catalogBrands);
    }
  });
});
