import { Types, type HydratedDocument, type PipelineStage } from "mongoose";
import { connectDB } from "./db";
import { getCatalogTypes } from "./catalog-types";
import { ProductModel, type Product, type ProductType } from "@/models/product";
import type {
  ProductDto,
  VariantDto,
} from "@/lib/dto";
import {
  facetDimensionsFor,
  type CatalogDimensionConfig,
  type CatalogTypeConfig,
} from "@/lib/catalog-types";
import { compareFacetValues } from "@/lib/facet-order";
import { buyablePriceCents } from "@/lib/pricing";
import { escapeRegex } from "@/lib/regex";
import type { SortKey } from "@/lib/validations/listing";

// Issue #35: the DTO types are pure and live in `src/lib/dto.ts`; re-exported here so
// every existing `import … from "@/server/search"` keeps working.
export type { ProductDto, VariantDto };

type LeanProduct = Omit<Product, "_id" | "collection" | "createdAt"> & {
  _id: Types.ObjectId;
  collection?: string;
  createdAt: Date;
};

function isComparableType(types: readonly CatalogTypeConfig[], type: string): boolean {
  return types.some((candidate) => candidate.key === type && candidate.comparable);
}

export function toProductDto(
  product: LeanProduct | HydratedDocument<Product>,
  comparable = false,
): ProductDto {
  const p = ("toObject" in product ? product.toObject() : product) as unknown as LeanProduct;
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    type: p.type,
    comparable,
    brand: p.brand,
    priceCents: p.priceCents,
    ...(() => {
      const price = buyablePriceCents(p.priceCents, p.variants.map((v) => v.priceDeltaCents));
      return { minPriceCents: price.priceCents, priceFrom: price.from };
    })(),
    images: p.images.map((image) => ({ src: image.src, alt: image.alt })),
    featured: p.featured,
    collection: p.collection ?? null,
    filter: Object.fromEntries(
      Object.entries(p.filter ?? {}).map(([key, values]) => [key, [...values]]),
    ),
    variants: p.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      priceDeltaCents: v.priceDeltaCents,
      stock: v.stock,
      restockThreshold: v.restockThreshold,
      weightGrams: v.weightGrams,
      attributes: { ...v.attributes },
    })),
    rating: { average: p.rating?.average ?? 0, count: p.rating?.count ?? 0 },
    createdAt: p.createdAt.toISOString(),
  };
}

export interface ListingQuery {
  type?: ProductType;
  brand?: string[];
  // Issue #61: facet selections keyed by the catalog type's dimension keys — the
  // query shape is the same for every attribute, seeded or newly configured.
  facets?: Record<string, string[]>;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  collection?: string;
}

const PAGE_SIZE = 24;

const SORTS: Record<SortKey, Record<string, 1 | -1>> = {
  "price-asc": { priceCents: 1, _id: 1 },
  "price-desc": { priceCents: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  // Issue #47: best-rated first; unrated products (average 0) fall to the back.
  rating: { "rating.average": -1, _id: 1 },
};

export function buildListingFilter(query: ListingQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.brand?.length) filter.brand = { $in: query.brand };
  for (const [key, values] of Object.entries(query.facets ?? {})) {
    if (values.length > 0) filter[`filter.${key}`] = { $in: values };
  }
  if (query.collection) filter.collection = query.collection;
  return filter;
}

export interface FacetValue {
  value: string;
  count: number;
}

// Issue #61: facet counts are computed for the dimensions the catalog configuration
// declares — brand plus every facet dimension of the types in scope.
export interface FacetCounts {
  brand: FacetValue[];
  dimensions: Record<string, FacetValue[]>;
}

export interface ListingResult {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
  facets: FacetCounts;
  // The facet dimensions the counts were computed for (from the catalog
  // configuration) — the sidebar renders exactly these.
  dimensions: CatalogDimensionConfig[];
}

interface GroupedCount {
  _id: string | number | null;
  count: number;
}

function toFacetValues(groups: GroupedCount[]): FacetValue[] {
  return groups
    .filter((g): g is { _id: string | number; count: number } => g._id != null)
    .map((g) => ({ value: String(g._id), count: g.count }))
    .sort((a, b) => compareFacetValues(a.value, b.value));
}

// Issue #24: each facet is counted over the active filter *without its own* condition
// (standard faceted search), so counts match what a click would produce and already
// selected values stay visible with their count. Issue #61: the dimensions come from
// the catalog configuration — `$facet` field names cannot contain dots, so each
// dimension is counted under an alias and mapped back.
async function facetCounts(
  filter: Record<string, unknown>,
  dimensions: readonly CatalogDimensionConfig[],
): Promise<FacetCounts> {
  const without = (key: string): Record<string, unknown> =>
    Object.fromEntries(Object.entries(filter).filter(([name]) => name !== key));

  const facet: Record<string, PipelineStage.FacetPipelineStage[]> = {
    brand: [{ $match: without("brand") }, { $group: { _id: "$brand", count: { $sum: 1 } } }],
  };
  dimensions.forEach((dimension, index) => {
    facet[`d${index}`] = [
      { $match: without(`filter.${dimension.key}`) },
      { $unwind: `$filter.${dimension.key}` },
      { $group: { _id: `$filter.${dimension.key}`, count: { $sum: 1 } } },
    ];
  });

  const [agg] = await ProductModel.aggregate<Record<string, GroupedCount[]>>([
    { $facet: facet },
  ]);
  const empty: GroupedCount[] = [];
  const counts: FacetCounts = { brand: toFacetValues(agg?.brand ?? empty), dimensions: {} };
  dimensions.forEach((dimension, index) => {
    counts.dimensions[dimension.key] = toFacetValues(agg?.[`d${index}`] ?? empty);
  });
  return counts;
}

export async function listProducts(query: ListingQuery): Promise<ListingResult> {
  await connectDB();
  const types = await getCatalogTypes();
  const dimensions = facetDimensionsFor(types, query.type);
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const sort = SORTS[query.sort ?? "newest"];
  const filter = buildListingFilter(query);

  const [total, facetResult] = await Promise.all([
    ProductModel.countDocuments(filter),
    facetCounts(filter, dimensions),
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  const docs = await ProductModel.find(filter)
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<LeanProduct[]>()
    .exec();

  return {
    items: docs.map((doc) => toProductDto(doc, isComparableType(types, doc.type))),
    total,
    page,
    pageSize,
    facets: facetResult,
    dimensions,
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDto | null> {
  await connectDB();
  const [product, types] = await Promise.all([
    ProductModel.findOne({ slug }).lean<LeanProduct>().exec(),
    getCatalogTypes(),
  ]);
  return product ? toProductDto(product, isComparableType(types, product.type)) : null;
}

// Products behind remembered slugs (issue #46 "Zuletzt angesehen"), in the requested
// order; unknown slugs are skipped.
export async function getProductsBySlugs(slugs: string[]): Promise<ProductDto[]> {
  if (slugs.length === 0) return [];
  await connectDB();
  const [docs, types] = await Promise.all([
    ProductModel.find({ slug: { $in: slugs } }).lean<LeanProduct[]>().exec(),
    getCatalogTypes(),
  ]);
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((doc): doc is LeanProduct => doc !== undefined)
    .map((doc) => toProductDto(doc, isComparableType(types, doc.type)));
}

export async function getRelatedProducts(product: ProductDto, limit = 4): Promise<ProductDto[]> {
  await connectDB();
  const [docs, types] = await Promise.all([
    ProductModel.find({
      type: product.type,
      slug: { $ne: product.slug },
    })
      .sort({ createdAt: -1, _id: 1 })
      .limit(limit * 4)
      .lean<LeanProduct[]>()
      .exec(),
    getCatalogTypes(),
  ]);
  const sameBrand = docs.filter((d) => d.brand === product.brand);
  const others = docs.filter((d) => d.brand !== product.brand);
  return [...sameBrand, ...others]
    .slice(0, limit)
    .map((doc) => toProductDto(doc, isComparableType(types, doc.type)));
}

export async function getFeaturedProducts(limit = 12): Promise<ProductDto[]> {
  await connectDB();
  const [docs, types] = await Promise.all([
    ProductModel.find({ featured: true })
      .sort({ createdAt: -1, _id: 1 })
      .limit(limit)
      .lean<LeanProduct[]>()
      .exec(),
    getCatalogTypes(),
  ]);
  return docs.map((doc) => toProductDto(doc, isComparableType(types, doc.type)));
}

// Products of one featured collection (issue #23), newest first.
export async function getCollectionProducts(collection: string, limit = 4): Promise<ProductDto[]> {
  await connectDB();
  const [docs, types] = await Promise.all([
    ProductModel.find({ collection })
      .sort({ createdAt: -1, _id: 1 })
      .limit(limit)
      .lean<LeanProduct[]>()
      .exec(),
    getCatalogTypes(),
  ]);
  return docs.map((doc) => toProductDto(doc, isComparableType(types, doc.type)));
}

export interface SearchHit {
  slug: string;
  name: string;
  type: ProductType;
  priceCents: number;
  priceFrom: boolean;
  image: string | null;
  variantHint: string;
}

export async function searchProducts(query: string, limit = 8): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  await connectDB();
  const prefix = new RegExp(`(?:^|\\b)${escapeRegex(trimmed)}`, "i");
  const docs = await ProductModel.find({ $or: [{ name: prefix }, { brand: prefix }] })
    .limit(limit)
    .lean<LeanProduct[]>()
    .exec();
  return docs.map((doc) => ({
    slug: doc.slug,
    name: doc.name,
    type: doc.type,
    ...(() => {
      const price = buyablePriceCents(doc.priceCents, doc.variants.map((v) => v.priceDeltaCents));
      return { priceCents: price.priceCents, priceFrom: price.from };
    })(),
    image: doc.images[0]?.src ?? null,
    variantHint: doc.variants[0]?.label ?? "",
  }));
}
