import { z } from "zod";
import { COLLECTIONS } from "@/lib/collections";
import type { CatalogTypeConfig } from "@/lib/catalog-types";

const sortKeys = ["price-asc", "price-desc", "newest", "rating"] as const;

export type SortKey = (typeof sortKeys)[number];

const first = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string().min(1),
);

// Issue #24: facets accept several values (`brand=Apple,Samsung`), so every facet param
// normalises to a de-duplicated list of non-empty strings.
const toList = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
};

const facetList = z.preprocess(toList, z.array(z.string().min(1).max(60)));

export interface ParsedListingParams {
  type?: string;
  brand?: string[];
  facets: Record<string, string[]>;
  sort?: SortKey;
  page?: number;
  collection?: string;
}

// Issue #61: the listing parameters are validated against the catalog type
// configuration — a facet param is accepted when a facet dimension of that name exists
// (for the selected type, or any type when browsing "Alle"). Junk falls back to unset.
export function parseListingParams(
  searchParams: Record<string, string | string[] | undefined>,
  types: readonly CatalogTypeConfig[],
): ParsedListingParams {
  const parsed: ParsedListingParams = { facets: {} };

  const rawType = first.safeParse(searchParams.type);
  const type = rawType.success ? types.find((t) => t.key === rawType.data) : undefined;
  if (type) parsed.type = type.key;

  if (searchParams.brand !== undefined) {
    const brand = facetList.safeParse(searchParams.brand);
    if (brand.success && brand.data.length > 0) parsed.brand = brand.data;
  }

  const facetKeys = new Set(
    (type ? [type] : [...types]).flatMap((t) => t.dimensions.filter((d) => d.facet).map((d) => d.key)),
  );
  for (const key of facetKeys) {
    if (searchParams[key] === undefined) continue;
    const values = facetList.safeParse(searchParams[key]);
    if (values.success && values.data.length > 0) parsed.facets[key] = values.data;
  }

  const sort = first.pipe(z.enum(sortKeys)).safeParse(searchParams.sort);
  if (sort.success) parsed.sort = sort.data;

  const page = first.transform(Number).pipe(z.number().int().min(1)).safeParse(searchParams.page);
  if (page.success) parsed.page = page.data;

  const collection = first.pipe(z.enum(COLLECTIONS)).safeParse(searchParams.collection);
  if (collection.success) parsed.collection = collection.data;

  return parsed;
}

export const searchQuerySchema = z.object({
  q: first.pipe(z.string().max(100)).optional(),
});

// Admin product list search parameters — validated instead of hand-parsed with casts
// (issue #32); every field falls back to "unset" instead of breaking the page. The
// type filter is free-form here; unknown keys simply match no product (issue #61).
export const adminProductsQuerySchema = z.object({
  q: first.pipe(z.string().max(100)).optional().catch(undefined),
  type: first.pipe(z.string().min(1).max(60)).optional().catch(undefined),
  page: first.transform(Number).pipe(z.number().int().min(1)).optional().catch(undefined),
});
