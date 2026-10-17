import { z } from "zod";
import { COLLECTIONS } from "@/lib/collections";

export const productTypes = ["smartphone", "shoes", "clothing"] as const;
export const sortKeys = ["price-asc", "price-desc", "newest"] as const;

export type SortKey = (typeof sortKeys)[number];

const first = z.preprocess(
  (value) => (Array.isArray(value) ? value[0] : value),
  z.string().min(1),
);

export const listingParamsSchema = z.object({
  type: first.pipe(z.enum(productTypes)).optional(),
  brand: first.optional(),
  size: first.optional(),
  color: first.optional(),
  storage: first.transform(Number).pipe(z.number().int().positive()).optional(),
  material: first.optional(),
  sort: first.pipe(z.enum(sortKeys)).optional(),
  page: first.transform(Number).pipe(z.number().int().min(1)).optional(),
  collection: first.pipe(z.enum(COLLECTIONS)).optional(),
});

export type ListingParams = z.infer<typeof listingParamsSchema>;

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
