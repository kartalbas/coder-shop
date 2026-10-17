import mongoose from "mongoose";
import { deriveFilter } from "@/lib/facets";
import { escapeRegex } from "@/lib/regex";
import type { ProductType } from "@/models/product";
import { ProductModel, type Product, type Variant } from "@/models/product";
import { productCoreSchema, variantCoreSchema } from "@/lib/validations/product";
import { toProductDto, type ProductDto } from "./search";
import { connectDB } from "./db";

export type ProductAdminResult = { ok: true } | { ok: false; error: string };

export interface ProductAdminListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  type: ProductType;
  priceCents: number;
  variantCount: number;
  totalStock: number;
  featured: boolean;
}

export interface ProductAdminListResult {
  items: ProductAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const ADMIN_PAGE_SIZE = 20;

export interface ProductAdminQuery {
  q?: string;
  type?: ProductType;
  page?: number;
}

export async function listProductsAdmin(
  query: ProductAdminQuery,
): Promise<ProductAdminListResult> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (query.type) filter.type = query.type;
  const q = query.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { brand: rx }, { "variants.sku": rx }];
  }

  const total = await ProductModel.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page ?? 1), pages);
  const products = await ProductModel.find(filter)
    .sort({ slug: 1 })
    .skip((page - 1) * ADMIN_PAGE_SIZE)
    .limit(ADMIN_PAGE_SIZE)
    .lean<Product[]>()
    .exec();

  return {
    items: products.map((product) => ({
      id: product._id.toString(),
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      type: product.type,
      priceCents: product.priceCents,
      variantCount: product.variants.length,
      totalStock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
      featured: product.featured,
    })),
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export async function getProductForAdmin(id: string): Promise<ProductDto | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  const product = await ProductModel.findById(id).lean().exec();
  return product ? toProductDto(product) : null;
}

export async function updateProductCore(id: string, input: unknown): Promise<ProductAdminResult> {
  const parsed = productCoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: "Produkt nicht gefunden." };

  const product = await ProductModel.findById(id).exec();
  if (!product) return { ok: false, error: "Produkt nicht gefunden." };

  product.name = parsed.data.name;
  product.description = parsed.data.description;
  product.brand = parsed.data.brand;
  product.priceCents = parsed.data.priceCents;
  // ARCHITECTURE §3: every write touching the variant/filter block recomputes `filter`.
  product.filter = deriveFilter(product.variants);
  await product.save();
  return { ok: true };
}

export async function updateVariantCore(
  productId: string,
  sku: string,
  input: unknown,
): Promise<ProductAdminResult> {
  const parsed = variantCoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  if (!mongoose.isValidObjectId(productId)) return { ok: false, error: "Produkt nicht gefunden." };

  const product = await ProductModel.findById(productId).exec();
  if (!product) return { ok: false, error: "Produkt nicht gefunden." };
  const variant = product.variants.find((candidate: Variant) => candidate.sku === sku);
  if (!variant) return { ok: false, error: `Variante ${sku} nicht gefunden.` };

  const { attributes } = parsed.data;
  variant.priceDeltaCents = parsed.data.priceDeltaCents;
  variant.stock = parsed.data.stock;
  variant.weightGrams = parsed.data.weightGrams;
  variant.attributes = {
    color: attributes.color,
    ...(attributes.size !== undefined && { size: attributes.size }),
    ...(attributes.storage !== undefined && { storage: attributes.storage }),
    ...(attributes.material !== undefined && { material: attributes.material }),
  };
  variant.label = [
    attributes.size ?? (attributes.storage !== undefined ? `${attributes.storage} GB` : null),
    attributes.color,
  ]
    .filter(Boolean)
    .join(" / ");
  // ARCHITECTURE §3: variant edits recompute the denormalized `filter` block.
  product.filter = deriveFilter(product.variants);
  product.markModified("variants");
  await product.save();
  return { ok: true };
}

export async function toggleFeaturedCore(productId: string): Promise<ProductAdminResult> {
  await connectDB();
  if (!mongoose.isValidObjectId(productId)) return { ok: false, error: "Produkt nicht gefunden." };
  const product = await ProductModel.findById(productId).select("featured").exec();
  if (!product) return { ok: false, error: "Produkt nicht gefunden." };
  product.featured = !product.featured;
  await product.save();
  return { ok: true };
}
