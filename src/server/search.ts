import { Types, type HydratedDocument } from "mongoose";
import { connectDB } from "./db";
import { ProductModel, type Product, type ProductFilter, type ProductType } from "@/models/product";
import type { ProductAttributes } from "@/lib/facets";
import { escapeRegex } from "@/lib/regex";
import type { SortKey } from "@/lib/validations/listing";

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
  images: { src: string; alt: string }[];
  featured: boolean;
  collection: string | null;
  filter: ProductFilter;
  variants: VariantDto[];
  createdAt: string;
}

type LeanProduct = Omit<Product, "_id" | "collection" | "createdAt"> & {
  _id: Types.ObjectId;
  collection?: string;
  createdAt: Date;
};

export function toProductDto(product: LeanProduct | HydratedDocument<Product>): ProductDto {
  const p = ("toObject" in product ? product.toObject() : product) as unknown as LeanProduct;
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    type: p.type,
    brand: p.brand,
    priceCents: p.priceCents,
    images: p.images.map((image) => ({ src: image.src, alt: image.alt })),
    featured: p.featured,
    collection: p.collection ?? null,
    filter: {
      colors: [...p.filter.colors],
      sizes: [...p.filter.sizes],
      storage: [...p.filter.storage],
      materials: [...p.filter.materials],
    },
    variants: p.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      priceDeltaCents: v.priceDeltaCents,
      stock: v.stock,
      restockThreshold: v.restockThreshold,
      weightGrams: v.weightGrams,
      attributes: { ...v.attributes },
    })),
    createdAt: p.createdAt.toISOString(),
  };
}

export interface ListingQuery {
  type?: ProductType;
  brand?: string;
  size?: string;
  color?: string;
  storage?: number;
  material?: string;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export const PAGE_SIZE = 24;

const SORTS: Record<SortKey, Record<string, 1 | -1>> = {
  "price-asc": { priceCents: 1, _id: 1 },
  "price-desc": { priceCents: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
};

export function buildListingFilter(query: ListingQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  if (query.brand) filter.brand = query.brand;
  if (query.size) filter["filter.sizes"] = query.size;
  if (query.color) filter["filter.colors"] = query.color;
  if (query.storage) filter["filter.storage"] = query.storage;
  if (query.material) filter["filter.materials"] = query.material;
  return filter;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface FacetCounts {
  brand: FacetValue[];
  sizes: FacetValue[];
  colors: FacetValue[];
  storage: FacetValue[];
  materials: FacetValue[];
}

export interface ListingResult {
  items: ProductDto[];
  total: number;
  page: number;
  pageSize: number;
  facets: FacetCounts;
}

interface GroupedCount {
  _id: string | number | null;
  count: number;
}

function toFacetValues(groups: GroupedCount[]): FacetValue[] {
  const values = groups
    .filter((g): g is { _id: string | number; count: number } => g._id != null)
    .map((g) => ({ value: String(g._id), count: g.count }));
  if (values.every((v) => /^\d+$/.test(v.value))) {
    values.sort((a, b) => Number(a.value) - Number(b.value));
  } else {
    values.sort((a, b) => a.value.localeCompare(b.value, "de"));
  }
  return values;
}

async function facetCounts(typeFilter: Record<string, unknown>): Promise<FacetCounts> {
  const [agg] = await ProductModel.aggregate<{
    brand: GroupedCount[];
    sizes: GroupedCount[];
    colors: GroupedCount[];
    storage: GroupedCount[];
    materials: GroupedCount[];
  }>([
    { $match: typeFilter },
    {
      $facet: {
        brand: [{ $group: { _id: "$brand", count: { $sum: 1 } } }],
        sizes: [
          { $unwind: "$filter.sizes" },
          { $group: { _id: "$filter.sizes", count: { $sum: 1 } } },
        ],
        colors: [
          { $unwind: "$filter.colors" },
          { $group: { _id: "$filter.colors", count: { $sum: 1 } } },
        ],
        storage: [
          { $unwind: "$filter.storage" },
          { $group: { _id: "$filter.storage", count: { $sum: 1 } } },
        ],
        materials: [
          { $unwind: "$filter.materials" },
          { $group: { _id: "$filter.materials", count: { $sum: 1 } } },
        ],
      },
    },
  ]);
  const empty: GroupedCount[] = [];
  return {
    brand: toFacetValues(agg?.brand ?? empty),
    sizes: toFacetValues(agg?.sizes ?? empty),
    colors: toFacetValues(agg?.colors ?? empty),
    storage: toFacetValues(agg?.storage ?? empty),
    materials: toFacetValues(agg?.materials ?? empty),
  };
}

export async function listProducts(query: ListingQuery): Promise<ListingResult> {
  await connectDB();
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const sort = SORTS[query.sort ?? "newest"];
  const filter = buildListingFilter(query);
  const typeFilter = query.type ? { type: query.type } : {};

  const [total, facetResult] = await Promise.all([
    ProductModel.countDocuments(filter),
    facetCounts(typeFilter),
  ]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  const docs = await ProductModel.find(filter)
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean<LeanProduct[]>()
    .exec();

  return { items: docs.map(toProductDto), total, page, pageSize, facets: facetResult };
}

export async function getProductBySlug(slug: string): Promise<ProductDto | null> {
  await connectDB();
  const product = await ProductModel.findOne({ slug }).lean<LeanProduct>().exec();
  return product ? toProductDto(product) : null;
}

export async function getRelatedProducts(product: ProductDto, limit = 4): Promise<ProductDto[]> {
  await connectDB();
  const docs = await ProductModel.find({
    type: product.type,
    slug: { $ne: product.slug },
  })
    .sort({ createdAt: -1, _id: 1 })
    .limit(limit * 4)
    .lean<LeanProduct[]>()
    .exec();
  const sameBrand = docs.filter((d) => d.brand === product.brand);
  const others = docs.filter((d) => d.brand !== product.brand);
  return [...sameBrand, ...others].slice(0, limit).map(toProductDto);
}

export async function getFeaturedProducts(limit = 12): Promise<ProductDto[]> {
  await connectDB();
  const docs = await ProductModel.find({ featured: true })
    .sort({ createdAt: -1, _id: 1 })
    .limit(limit)
    .lean<LeanProduct[]>()
    .exec();
  return docs.map(toProductDto);
}

export interface SearchHit {
  slug: string;
  name: string;
  type: ProductType;
  priceCents: number;
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
    priceCents: doc.priceCents,
    image: doc.images[0]?.src ?? null,
    variantHint:
      doc.variants.length > 0 ? doc.variants[0].label : `${doc.filter.colors.length} Farben`,
  }));
}
