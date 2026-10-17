import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { compareFacetValuesByOrder } from "@/lib/facet-order";

// Issue #61: variant attributes are a generic record keyed by the catalog type's
// dimension keys (color, size, storage, material, …) — the shape is data
// (`product_type_configs`), not a fixed interface.
export type ProductAttributes = Record<string, string | number>;

// The denormalized facet block (ARCHITECTURE §3) — the persisted `Product.filter`
// shape: dimension key → its values across the variants, ordered per the dimension's
// order rule, all stringified so one query shape fits every attribute.
export type ProductFilter = Record<string, string[]>;

export interface VariantForFacets {
  attributes: ProductAttributes;
}

// Fallback for products whose type configuration no longer exists: infer the dimension
// keys from the variant attributes themselves (locale order, no unit).
export function dimensionsFromAttributes(
  variants: readonly VariantForFacets[],
): CatalogDimensionConfig[] {
  const keys = [...new Set(variants.flatMap((v) => Object.keys(v.attributes)))].sort();
  return keys.map((key) => {
    const values = variants.map((v) => v.attributes[key]).filter((value) => value != null);
    const numeric =
      values.length > 0 && values.every((value) => /^\d+$/.test(String(value).trim()));
    return { key, label: key, facet: true, order: numeric ? "numeric" : "alpha" };
  });
}

export function deriveFilter(
  variants: VariantForFacets[],
  dimensions: readonly CatalogDimensionConfig[],
): ProductFilter {
  const filter: ProductFilter = {};
  for (const dimension of dimensions) {
    const values = [
      ...new Set(
        variants
          .map((v) => v.attributes[dimension.key])
          .filter((value) => value !== undefined && value !== null)
          .map(String),
      ),
    ].sort((a, b) => compareFacetValuesByOrder(dimension.order, a, b));
    if (values.length > 0) filter[dimension.key] = values;
  }
  return filter;
}
