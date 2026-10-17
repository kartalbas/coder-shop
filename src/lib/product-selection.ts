import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { compareFacetValuesByOrder } from "@/lib/facet-order";
import type { ProductDto, VariantDto } from "@/lib/dto";

// Issue #61: the variant picker is driven by the product type's configured dimensions —
// labels, order rule and unit come from `product_type_configs`, never from a fixed set.

export type Selection = Record<string, string | null>;

export interface Dimension {
  key: string;
  label: string;
  unit?: string;
  values: string[];
}

export function dimensionsOf(
  product: ProductDto,
  typeDimensions: readonly CatalogDimensionConfig[],
): Dimension[] {
  return typeDimensions
    .map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      ...(dimension.unit ? { unit: dimension.unit } : {}),
      values: [
        ...new Set(
          product.variants
            .map((v) => v.attributes[dimension.key])
            .filter((value) => value !== undefined && value !== null)
            .map(String),
        ),
      ].sort((a, b) => compareFacetValuesByOrder(dimension.order, a, b)),
    }))
    .filter((dimension) => dimension.values.length > 0);
}

export function matchesSelection(variant: VariantDto, selection: Selection): boolean {
  return Object.entries(selection).every(([key, wanted]) => {
    if (wanted == null) return true;
    return String(variant.attributes[key] ?? "") === wanted;
  });
}

// Every dimension the product has must be chosen before the item can go to the cart
// (issue #18) — the labels of what is still missing.
export function missingDimensions(dimensions: Dimension[], selection: Selection): string[] {
  return dimensions.filter((d) => selection[d.key] == null).map((d) => d.label);
}

export function formatSelectionValue(dimension: Dimension, value: string): string {
  return dimension.unit ? `${value} ${dimension.unit}` : value;
}

// Photo slot i shows the colour of variant i % variantCount (the rule the image
// generator used, scripts/images/generate.ts) — so a chosen colour maps back to the
// slots that depict it (issue #19). The photo pipeline is keyed on the "color"
// attribute; types without one always show slot 0.
export function slotColor(variants: VariantDto[], slot: number): string | undefined {
  if (variants.length === 0) return undefined;
  const color = variants[slot % variants.length]?.attributes.color;
  return color === undefined || color === null ? undefined : String(color);
}

export function imageIndexForColor(
  imageCount: number,
  variants: VariantDto[],
  color: string | null,
): number {
  if (!color || imageCount === 0) return 0;
  for (let i = 0; i < imageCount; i++) {
    if (slotColor(variants, i) === color) return i;
  }
  return 0;
}

