// Issue #61 (docs/REQUIREMENTS.md "AGNOSTIC AND DYNAMIC"): the catalog's product
// types, their variant dimensions and facets are DATA, not code. The persisted source
// is the `product_type_configs` collection; `DEFAULT_CATALOG_TYPES` below is only the
// seed content for it. Generic code (listing, filters, product page, cart, admin)
// reads the configuration — adding a type or attribute needs no code change.

import {
  contentLabel,
  dimensionLabelKey,
  typeLabelKey,
  valueLabelKey,
  type LabelMap,
} from "@/lib/i18n";
import type { ProductAttributes } from "@/lib/facets";

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
function formatDimensionValue(dimension: CatalogDimensionConfig, value: string): string {
  return dimension.unit ? `${value} ${dimension.unit}` : value;
}

// The same value in a request language (#58 step B1b): the value text resolves through
// the translation table (fallback: the value itself — machine values like sizes or GB
// counts carry no rows and stay values), the unit suffix stays the display convention
// it always was. Without a label map the value is German by construction.
export function formatLocalizedDimensionValue(
  dimension: CatalogDimensionConfig,
  value: string,
  content?: LabelMap,
): string {
  const text = content ? contentLabel(content, valueLabelKey(dimension.key, value), value) : value;
  return formatDimensionValue(dimension, text);
}

// The composed label of one variant ("schwarz / 256 GB") — the single composition rule
// (dimension order, unit, joiner) shared by the seed, the admin write path and the
// DTO, so the label is never spelled twice. With a content map every attribute value
// resolves through the table first (#58 step B1b); without one the label is the stored
// German by construction.
export function variantLabel(
  dimensions: readonly CatalogDimensionConfig[],
  attributes: ProductAttributes | undefined,
  content?: LabelMap,
): string {
  const values = attributes ?? {};
  return dimensions
    .map((dimension) =>
      formatLocalizedDimensionValue(dimension, String(values[dimension.key] ?? ""), content),
    )
    .join(" / ");
}

// The dimension captions of a facet column in a request language (#58 step B1b) —
// the same table resolution as `localizeCatalogTypes`, for a bare dimension list.
export function localizeDimensions(
  dimensions: readonly CatalogDimensionConfig[],
  content: LabelMap,
): CatalogDimensionConfig[] {
  return dimensions.map((dimension) => ({
    ...dimension,
    label: contentLabel(content, dimensionLabelKey(dimension.key), dimension.label),
  }));
}

// The catalog type configuration in a request language (#58 step B1b): the type label
// and every dimension label resolve through the table (fallback: the configured label,
// which is the German base — `product_type_configs.label` stays the machine-side
// name). Keys, params, URLs and units are machine values and never change; without a
// label map the configuration is German by construction, so admin, APIs and stored
// orders keep reading the configuration itself.
export function localizeCatalogTypes(
  types: readonly CatalogTypeConfig[],
  content?: LabelMap,
): CatalogTypeConfig[] {
  if (!content) return [...types];
  return types.map((type) => ({
    ...type,
    label: contentLabel(content, typeLabelKey(type.key), type.label),
    dimensions: localizeDimensions(type.dimensions, content),
  }));
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
    // Issue #62 (#54): smartphones are stocked as individual units (IMEI) — their
    // variant stock is the count of in-stock serial units.
    stockTracking: "serial",
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
