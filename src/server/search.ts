import { Types, type HydratedDocument, type PipelineStage } from "mongoose";
import { connectDB } from "./db";
import { getCatalogTypes } from "./catalog-types";
import { ProductModel, type Product, type ProductType } from "@/models/product";
import type {
  ProductDto,
  VariantDto,
} from "@/lib/dto";
import {
  dimensionsForTypes,
  facetDimensionsFor,
  localizeDimensions,
  variantLabel,
  type CatalogDimensionConfig,
  type CatalogTypeConfig,
} from "@/lib/catalog-types";
import { compareFacetValues } from "@/lib/facet-order";
import { contentLabel, productContentKeys, type LabelMap } from "@/lib/i18n";
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

// Issue #58 step B1a: the stored document stays the German base — one source, no
// per-language fields. `content` is the request language's label map: with one,
// name and description resolve through the translation table (falling back to the
// document's German); without one the DTO is German by construction, so admin pages,
// the JSON APIs and stored orders never change. Issue #58 step B1b: with the product
// type's configured `dimensions` too, the variant labels are recomposed from the
// translated attribute values (the stored German label stays untouched).
export function toProductDto(
  product: LeanProduct | HydratedDocument<Product>,
  comparable = false,
  content?: LabelMap,
  dimensions?: readonly CatalogDimensionConfig[],
): ProductDto {
  const p = ("toObject" in product ? product.toObject() : product) as unknown as LeanProduct;
  const keys = productContentKeys(p.slug);
  const localizeVariantLabel = content !== undefined && dimensions !== undefined;
  return {
    id: String(p._id),
    slug: p.slug,
    name: content ? contentLabel(content, keys.name, p.name) : p.name,
    description: content ? contentLabel(content, keys.description, p.description) : p.description,
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
      label: localizeVariantLabel
        ? variantLabel(dimensions, v.attributes, content)
        : v.label,
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

// The configured dimensions of one product type — what `toProductDto` needs to
// recompose localized variant labels (#58 step B1b).
function dimensionsOfType(
  types: readonly CatalogTypeConfig[],
  type: string,
): CatalogDimensionConfig[] {
  return dimensionsForTypes(types, [type]);
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

export async function listProducts(
  query: ListingQuery,
  content?: LabelMap,
): Promise<ListingResult> {
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
    items: docs.map((doc) =>
      toProductDto(
        doc,
        isComparableType(types, doc.type),
        content,
        content ? dimensionsOfType(types, doc.type) : undefined,
      ),
    ),
    total,
    page,
    pageSize,
    facets: facetResult,
    // #58 step B1b: with a content map the sidebar's dimension captions answer in the
    // request language (keys and units stay the machine values).
    dimensions: content ? localizeDimensions(dimensions, content) : dimensions,
  };
}

export async function getProductBySlug(
  slug: string,
  content?: LabelMap,
): Promise<ProductDto | null> {
  await connectDB();
  const [product, types] = await Promise.all([
    ProductModel.findOne({ slug }).lean<LeanProduct>().exec(),
    getCatalogTypes(),
  ]);
  return product
    ? toProductDto(
        product,
        isComparableType(types, product.type),
        content,
        content ? dimensionsOfType(types, product.type) : undefined,
      )
    : null;
}

// Products behind remembered slugs (issue #46 "Zuletzt angesehen"), in the requested
// order; unknown slugs are skipped.
export async function getProductsBySlugs(
  slugs: string[],
  content?: LabelMap,
): Promise<ProductDto[]> {
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
    .map((doc) =>
      toProductDto(
        doc,
        isComparableType(types, doc.type),
        content,
        content ? dimensionsOfType(types, doc.type) : undefined,
      ),
    );
}

export async function getRelatedProducts(
  product: ProductDto,
  limit = 4,
  content?: LabelMap,
): Promise<ProductDto[]> {
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
    .map((doc) =>
      toProductDto(
        doc,
        isComparableType(types, doc.type),
        content,
        content ? dimensionsOfType(types, doc.type) : undefined,
      ),
    );
}

export async function getFeaturedProducts(
  limit = 12,
  content?: LabelMap,
): Promise<ProductDto[]> {
  await connectDB();
  const [docs, types] = await Promise.all([
    ProductModel.find({ featured: true })
      .sort({ createdAt: -1, _id: 1 })
      .limit(limit)
      .lean<LeanProduct[]>()
      .exec(),
    getCatalogTypes(),
  ]);
  return docs.map((doc) =>
    toProductDto(
      doc,
      isComparableType(types, doc.type),
      content,
      content ? dimensionsOfType(types, doc.type) : undefined,
    ),
  );
}

// Products of one featured collection (issue #23), newest first.
export async function getCollectionProducts(
  collection: string,
  limit = 4,
  content?: LabelMap,
): Promise<ProductDto[]> {
  await connectDB();
  const [docs, types] = await Promise.all([
    ProductModel.find({ collection })
      .sort({ createdAt: -1, _id: 1 })
      .limit(limit)
      .lean<LeanProduct[]>()
      .exec(),
    getCatalogTypes(),
  ]);
  return docs.map((doc) =>
    toProductDto(
      doc,
      isComparableType(types, doc.type),
      content,
      content ? dimensionsOfType(types, doc.type) : undefined,
    ),
  );
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

// Issue #58 step B1b: with a content map the hit's name and variant hint answer in the
// request language — **matching stays on the stored German name/brand** (translated-
// name search is a recorded limitation), so a French reader still finds "iPhone".
export async function searchProducts(
  query: string,
  limit = 8,
  content?: LabelMap,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  await connectDB();
  const prefix = new RegExp(`(?:^|\\b)${escapeRegex(trimmed)}`, "i");
  const [docs, types] = await Promise.all([
    ProductModel.find({ $or: [{ name: prefix }, { brand: prefix }] })
      .limit(limit)
      .lean<LeanProduct[]>()
      .exec(),
    content ? getCatalogTypes() : Promise.resolve([]),
  ]);
  return docs.map((doc) => {
    const keys = productContentKeys(doc.slug);
    const first = doc.variants[0];
    return {
      slug: doc.slug,
      name: content ? contentLabel(content, keys.name, doc.name) : doc.name,
      type: doc.type,
      ...(() => {
        const price = buyablePriceCents(doc.priceCents, doc.variants.map((v) => v.priceDeltaCents));
        return { priceCents: price.priceCents, priceFrom: price.from };
      })(),
      image: doc.images[0]?.src ?? null,
      variantHint:
        content && first
          ? variantLabel(dimensionsOfType(types, doc.type), first.attributes, content)
          : (first?.label ?? ""),
    };
  });
}
