import { z } from "zod";
import { COLLECTIONS } from "@/lib/collections";

export const productTypes = ["smartphone", "shoes", "clothing"] as const;
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
const storageList = z.preprocess(
  (value) => toList(value).map(Number),
  z.array(z.number().int().positive().max(8192)),
);

export const listingParamsSchema = z.object({
  type: first.pipe(z.enum(productTypes)).optional(),
  brand: facetList.optional(),
  size: facetList.optional(),
  color: facetList.optional(),
  storage: storageList.optional(),
  material: facetList.optional(),
  sort: first.pipe(z.enum(sortKeys)).optional(),
  page: first.transform(Number).pipe(z.number().int().min(1)).optional(),
  collection: first.pipe(z.enum(COLLECTIONS)).optional(),
});


export const searchQuerySchema = z.object({
  q: first.pipe(z.string().max(100)).optional(),
});

// Admin product list search parameters — validated instead of hand-parsed with casts
// (issue #32); every field falls back to "unset" instead of breaking the page.
export const adminProductsQuerySchema = z.object({
  q: first.pipe(z.string().max(100)).optional().catch(undefined),
  type: first.pipe(z.enum(productTypes)).optional().catch(undefined),
  page: first.transform(Number).pipe(z.number().int().min(1)).optional().catch(undefined),
});
