import type { ProductType } from "@/lib/product-types";

// The catalog's brand set per product type — the single source for the seed generator,
// the mega-menu and the tests (issue #31). Adding a brand here adds products and a menu
// entry; tests/mega-menu.test.ts keeps the seed's model tables in step.
export const CATALOG_BRANDS: Record<ProductType, readonly string[]> = {
  smartphone: ["Apple", "Samsung", "Xiaomi", "Google", "OnePlus"],
  shoes: ["Nike", "Adidas", "Puma", "On", "New Balance"],
  clothing: ["The North Face", "Jack Wolfskin", "Mammut", "Vaude", "Patagonia"],
};
