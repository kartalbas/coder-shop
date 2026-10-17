import type { ProductDto } from "@/lib/dto";

// Comparison table rules (issue #48) — pure: which smartphones can be compared, the
// row values, and which rows differ (those are the ones highlighted on the page).

export const COMPARE_MAX_PRODUCTS = 4;

export function comparableProducts(products: ProductDto[]): ProductDto[] {
  return products.filter((product) => product.type === "smartphone").slice(0, COMPARE_MAX_PRODUCTS);
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

function formatWeight(product: ProductDto): string {
  const min = minWeight(product);
  const max = maxWeight(product);
  return min === max ? `${min} g` : `${min}–${max} g`;
}

function formatStorages(product: ProductDto): string {
  return [...product.filter.storage].sort((a, b) => a - b).map((gb) => `${gb} GB`).join(", ");
}

function formatColors(product: ProductDto): string {
  return [...product.filter.colors].sort().join(", ");
}

function formatPrice(product: ProductDto): string {
  const price = (product.minPriceCents / 100).toLocaleString("de-CH", {
    style: "currency",
    currency: "CHF",
  });
  return product.priceFrom ? `ab ${price}` : price;
}

function formatStock(product: ProductDto): string {
  const total = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  return total === 0 ? "Ausverkauft" : `${total} Stück`;
}

export function buildComparisonRows(products: ProductDto[]): ComparisonRow[] {
  const definitions: { label: string; value: (product: ProductDto) => string }[] = [
    { label: "Preis", value: formatPrice },
    { label: "Marke", value: (product) => product.brand },
    { label: "Speicheroptionen", value: formatStorages },
    { label: "Farben", value: formatColors },
    { label: "Gewicht", value: formatWeight },
    { label: "Varianten", value: (product) => `${product.variants.length}` },
    { label: "Verfügbar", value: formatStock },
  ];
  return definitions.map(({ label, value }) => {
    const values = products.map(value);
    return { label, values, differs: new Set(values).size > 1 };
  });
}
