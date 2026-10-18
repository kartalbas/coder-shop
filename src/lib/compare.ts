import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { formatDimensionValue } from "@/lib/catalog-types";
import type { ProductDto } from "@/lib/dto";
import { createFormatters } from "@/lib/format";
import { interpolate, label, plural, type LabelMap } from "@/lib/i18n";

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

function formatPrice(product: ProductDto, intlLocale: string, labels: LabelMap): string {
  const price = createFormatters(intlLocale).chf(product.minPriceCents);
  // Same join as the product card — the row carries the word, its position is the
  // translator's (#58 step 3).
  return product.priceFrom ? `${label(labels, "shop.price.from")} ${price}` : price;
}

function formatStock(product: ProductDto, intlLocale: string, labels: LabelMap): string {
  const total = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  if (total === 0) return label(labels, "shop.state.soldOut");
  return interpolate(plural(labels, total, "shop.compare.stockValue", intlLocale), {
    count: total,
  });
}

// Issue #58 step 2b: prices and weights follow the request language's Intl locale;
// step 3: the row labels and stock values are translation-table texts (data in —
// the lib stays pure).
export function buildComparisonRows(
  products: ProductDto[],
  dimensions: readonly CatalogDimensionConfig[],
  intlLocale: string,
  labels: LabelMap,
): ComparisonRow[] {
  const definitions: { label: string; value: (product: ProductDto) => string }[] = [
    { label: label(labels, "shop.compare.row.price"), value: (product) => formatPrice(product, intlLocale, labels) },
    { label: label(labels, "shop.compare.row.brand"), value: (product) => product.brand },
    ...dimensions.map((dimension) => ({
      label: dimension.label,
      value: (product: ProductDto) => formatDimension(dimension, product),
    })),
    { label: label(labels, "shop.compare.row.weight"), value: (product) => formatWeight(product, intlLocale) },
    { label: label(labels, "shop.compare.row.variants"), value: (product) => `${product.variants.length}` },
    { label: label(labels, "shop.compare.row.availability"), value: (product) => formatStock(product, intlLocale, labels) },
  ];
  return definitions.map(({ label, value }) => {
    const values = products.map(value);
    return { label, values, differs: new Set(values).size > 1 };
  });
}
