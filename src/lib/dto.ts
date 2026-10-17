// The product DTO (ARCHITECTURE §4) — pure types (issue #35): `src/lib` must not import
// from `src/server`; `server/search.ts` re-exports these for its consumers and produces
// them in `toProductDto()`.
import type { ProductAttributes, ProductFilter } from "@/lib/facets";
import type { ProductType } from "@/lib/product-types";

export interface VariantDto {
  sku: string;
  label: string;
  priceDeltaCents: number;
  stock: number;
  restockThreshold: number;
  weightGrams: number;
  attributes: ProductAttributes;
}

export interface ProductDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: ProductType;
  brand: string;
  priceCents: number;
  minPriceCents: number;
  priceFrom: boolean;
  images: { src: string; alt: string }[];
  featured: boolean;
  collection: string | null;
  filter: ProductFilter;
  variants: VariantDto[];
  createdAt: string;
}
