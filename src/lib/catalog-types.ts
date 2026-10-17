// Issue #61 (docs/REQUIREMENTS.md "AGNOSTIC AND DYNAMIC"): the catalog's product
// types, their variant dimensions and facets are DATA, not code. The persisted source
// is the `product_type_configs` collection; `DEFAULT_CATALOG_TYPES` below is only the
// seed content for it. Generic code (listing, filters, product page, cart, admin)
// reads the configuration — adding a type or attribute needs no code change.
export type FacetOrder = "alpha" | "numeric" | "clothing-size";

export type StockTracking = "quantity" | "serial";

export interface CatalogDimensionConfig {
  /** Variant attribute key this dimension reads, e.g. "color". */
  key: string;
  /** UI label, e.g. "Farbe". */
  label: string;
  /** Shown as a filter in the listing's facet column. */
  facet: boolean;
  /** How the values are ordered. */
  order: FacetOrder;
  /** Display suffix for values, e.g. "GB". */
  unit?: string;
}

export interface CatalogTypeConfig {
  /** URL/param key, e.g. "smartphone". */
  key: string;
  /** UI label, e.g. "Smartphones". */
  label: string;
  /** Order in menus and tabs. */
  position: number;
  dimensions: CatalogDimensionConfig[];
  /** How variant stock is kept (issue #62): counted units or tracked serials. */
  stockTracking: StockTracking;
  /** Products of this type can be put into the side-by-side comparison (issue #48/#61). */
  comparable: boolean;
  /** English subject for the photo-prompt generator (issue #61 review) — a runtime-added type carries its own noun. */
  photoNoun: string;
  /** The type's demo brands — seed content and mega-menu columns (issue #31 sync). */
  brands: string[];
}

// All dimensions of the given types (all types when no keys are given), in position
// order, deduplicated by key — the first configured occurrence wins.
export function dimensionsForTypes(
  types: readonly CatalogTypeConfig[],
  typeKeys?: readonly string[],
): CatalogDimensionConfig[] {
  const scope = [...types]
    .sort((a, b) => a.position - b.position)
    .filter((type) => !typeKeys || typeKeys.includes(type.key));
  const seen = new Set<string>();
  const dimensions: CatalogDimensionConfig[] = [];
  for (const type of scope) {
    for (const dimension of type.dimensions) {
      if (seen.has(dimension.key)) continue;
      seen.add(dimension.key);
      dimensions.push(dimension);
    }
  }
  return dimensions;
}

// The facet dimensions the listing sidebar and the `$facet` counts work over: the
// selected type's facets, or the union over all types when browsing "Alle".
export function facetDimensionsFor(
  types: readonly CatalogTypeConfig[],
  typeKey?: string,
): CatalogDimensionConfig[] {
  return dimensionsForTypes(types, typeKey ? [typeKey] : undefined).filter((d) => d.facet);
}

export function allFacetDimensionKeys(types: readonly CatalogTypeConfig[]): string[] {
  return facetDimensionsFor(types).map((d) => d.key);
}

// A dimension value as displayed, e.g. "256 GB" for the storage dimension.
export function formatDimensionValue(dimension: CatalogDimensionConfig, value: string): string {
  return dimension.unit ? `${value} ${dimension.unit}` : value;
}

const COLOR: CatalogDimensionConfig = { key: "color", label: "Farbe", facet: true, order: "alpha" };

// Seed content of `product_type_configs` — the three demo types with their real
// dimensions (smartphones have storage, no size; shoes EU sizes; clothing garment
// sizes + material).
export const DEFAULT_CATALOG_TYPES: readonly CatalogTypeConfig[] = [
  {
    key: "smartphone",
    label: "Smartphones",
    position: 1,
    stockTracking: "quantity",
    comparable: true,
    photoNoun: "smartphone",
    brands: ["Apple", "Samsung", "Xiaomi", "Google", "OnePlus"],
    dimensions: [
      COLOR,
      { key: "storage", label: "Speicher", facet: true, order: "numeric", unit: "GB" },
    ],
  },
  {
    key: "shoes",
    label: "Schuhe",
    position: 2,
    stockTracking: "quantity",
    comparable: false,
    photoNoun: "athletic sneaker",
    brands: ["Nike", "Adidas", "Puma", "On", "New Balance"],
    dimensions: [
      COLOR,
      { key: "size", label: "Grösse", facet: true, order: "numeric" },
    ],
  },
  {
    key: "clothing",
    label: "Kleidung",
    position: 3,
    stockTracking: "quantity",
    comparable: false,
    photoNoun: "outdoor garment",
    brands: ["The North Face", "Jack Wolfskin", "Mammut", "Vaude", "Patagonia"],
    dimensions: [
      COLOR,
      { key: "size", label: "Grösse", facet: true, order: "clothing-size" },
      { key: "material", label: "Material", facet: true, order: "alpha" },
    ],
  },
];
