import { z } from "zod";

export const productTypes = ["smartphone", "shoes", "clothing"] as const;
export const sortKeys = ["price-asc", "price-desc", "newest"] as const;

export type ProductTypeParam = (typeof productTypes)[number];
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
});

export type ListingParams = z.infer<typeof listingParamsSchema>;

export const searchQuerySchema = z.object({
  q: first.pipe(z.string().max(100)).optional(),
});
