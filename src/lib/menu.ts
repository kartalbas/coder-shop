import type { ProductType } from "@/models/product";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  smartphone: "Smartphones",
  shoes: "Schuhe",
  clothing: "Kleidung",
};

export interface MenuCategory {
  type: ProductType;
  label: string;
  brands: readonly string[];
}

const MENU_BRANDS: Record<ProductType, readonly string[]> = {
  smartphone: ["Apple", "Samsung", "Xiaomi", "Google", "OnePlus"],
  shoes: ["Nike", "Adidas", "Puma", "On", "New Balance"],
  clothing: ["The North Face", "Jack Wolfskin", "Mammut", "Vaude", "Patagonia"],
};

// Kept in sync with the seeded catalog (scripts/seed/catalog.ts) — enforced by
// tests/mega-menu.test.ts, which asserts every listed brand exists in the catalog.
export const MENU_CATEGORIES: readonly MenuCategory[] = (
  ["smartphone", "shoes", "clothing"] as const
).map((type) => ({
  type,
  label: PRODUCT_TYPE_LABELS[type],
  brands: MENU_BRANDS[type],
}));
