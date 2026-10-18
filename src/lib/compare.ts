import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { formatDimensionValue } from "@/lib/catalog-types";
import type { ProductDto } from "@/lib/dto";
import { createFormatters } from "@/lib/format";

// Comparison table rules (issue #48) — pure: which products can be compared, the
// row values, and which rows differ (those are the ones highlighted on the page).
// Issue #61: comparability is a flag on the catalog type configuration, and the
// attribute rows are the type's configured dimensions — not a fixed list.

export const COMPARE_MAX_PRODUCTS = 4;

export function comparableProducts(
  products: ProductDto[],
  comparableTypeKeys: ReadonlySet<string>,
): ProductDto[] {
  return products
    .filter((product) => comparableTypeKeys.has(product.type))
    .slice(0, COMPARE_MAX_PRODUCTS);
}

export interface ComparisonRow {
  label: string;
  // One display value per compared product, same order.
  values: string[];
  // True when the products do not all show the same value — the UI highlights it.
  differs: boolean;
}

function minWeight(product: ProductDto): number {
  return Math.min(...product.variants.map((variant) => variant.weightGrams));
}

function maxWeight(product: ProductDto): number {
  return Math.max(...product.variants.map((variant) => variant.weightGrams));
}

function formatWeight(product: ProductDto, intlLocale: string): string {
  const { weight, number } = createFormatters(intlLocale);
  const min = minWeight(product);
  const max = maxWeight(product);
  return min === max ? weight(min) : `${number(min)}–${number(max)} g`;
}

function formatDimension(dimension: CatalogDimensionConfig, product: ProductDto): string {
  return (product.filter[dimension.key] ?? [])
    .map((value) => formatDimensionValue(dimension, value))
    .join(", ");
}

function formatPrice(product: ProductDto, intlLocale: string): string {
  const price = createFormatters(intlLocale).chf(product.minPriceCents);
  return product.priceFrom ? `ab ${price}` : price;
}

function formatStock(product: ProductDto): string {
  const total = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  return total === 0 ? "Ausverkauft" : `${total} Stück`;
}

// Issue #58 step 2b: prices and weights follow the request language's Intl locale.
export function buildComparisonRows(
  products: ProductDto[],
  dimensions: readonly CatalogDimensionConfig[],
  intlLocale: string,
): ComparisonRow[] {
  const definitions: { label: string; value: (product: ProductDto) => string }[] = [
    { label: "Preis", value: (product) => formatPrice(product, intlLocale) },
    { label: "Marke", value: (product) => product.brand },
    ...dimensions.map((dimension) => ({
      label: dimension.label,
      value: (product: ProductDto) => formatDimension(dimension, product),
    })),
    { label: "Gewicht", value: (product) => formatWeight(product, intlLocale) },
    { label: "Varianten", value: (product) => `${product.variants.length}` },
    { label: "Verfügbar", value: formatStock },
  ];
  return definitions.map(({ label, value }) => {
    const values = products.map(value);
    return { label, values, differs: new Set(values).size > 1 };
  });
}
