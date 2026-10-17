import { CATALOG_BRANDS } from "@/lib/brands";
import type { ProductType } from "@/lib/product-types";

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

// Brands come from the single catalog brand set (src/lib/brands.ts) — the same source the
// seed generator uses; tests/mega-menu.test.ts keeps the seed's model tables in step.
export const MENU_CATEGORIES: readonly MenuCategory[] = (
  ["smartphone", "shoes", "clothing"] as const
).map((type) => ({
  type,
  label: PRODUCT_TYPE_LABELS[type],
  brands: CATALOG_BRANDS[type],
}));
