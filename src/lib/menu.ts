import { DEFAULT_CATALOG_TYPES, type CatalogTypeConfig } from "@/lib/catalog-types";

// Issue #61: menu categories, type labels and brand columns all come from the catalog
// type configuration (seeded from `DEFAULT_CATALOG_TYPES`, editable as data) — the
// mega-menu renders whatever types exist, no hard-coded list (issue #31 sync).
export interface MenuCategory {
  type: string;
  label: string;
  brands: readonly string[];
}

export function menuCategories(
  types: readonly CatalogTypeConfig[] = DEFAULT_CATALOG_TYPES,
): MenuCategory[] {
  return [...types]
    .sort((a, b) => a.position - b.position)
    .map((type) => ({ type: type.key, label: type.label, brands: type.brands }));
}
