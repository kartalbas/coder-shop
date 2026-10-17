import mongoose from "mongoose";
import { deriveFilter } from "@/lib/facets";
import { escapeRegex } from "@/lib/regex";
import type { ProductType } from "@/models/product";
import { ProductModel, type Product, type Variant } from "@/models/product";
import {
  productCoreSchema,
  productImagesSchema,
  variantCoreSchema,
} from "@/lib/validations/product";
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

  // Atomic $set of the core fields only — a whole-document save would clobber stock
  // that changed between this read and the write (issue #13).
  const result = await ProductModel.updateOne(
    { _id: product._id },
    {
      $set: {
        name: parsed.data.name,
        description: parsed.data.description,
        brand: parsed.data.brand,
        priceCents: parsed.data.priceCents,
        // ARCHITECTURE §3: every write touching the variant/filter block recomputes `filter`.
        filter: deriveFilter(product.variants),
      },
    },
  );
  if (result.matchedCount === 0) return { ok: false, error: "Produkt nicht gefunden." };
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

  const product = await ProductModel.findById(productId).lean<Product>().exec();
  if (!product) return { ok: false, error: "Produkt nicht gefunden." };
  const variant = product.variants.find((candidate: Variant) => candidate.sku === sku);
  if (!variant) return { ok: false, error: `Variante ${sku} nicht gefunden.` };

  const { attributes, stock, expectedStock } = parsed.data;
  const stockEdited = stock !== expectedStock;

  const updatedVariant: Variant = {
    ...variant,
    priceDeltaCents: parsed.data.priceDeltaCents,
    stock,
    weightGrams: parsed.data.weightGrams,
    attributes: {
      color: attributes.color,
      ...(attributes.size !== undefined && { size: attributes.size }),
      ...(attributes.storage !== undefined && { storage: attributes.storage }),
      ...(attributes.material !== undefined && { material: attributes.material }),
    },
    label: [
      attributes.size ?? (attributes.storage !== undefined ? `${attributes.storage} GB` : null),
      attributes.color,
    ]
      .filter(Boolean)
      .join(" / "),
  };

  const set: Record<string, unknown> = {
    "variants.$.priceDeltaCents": updatedVariant.priceDeltaCents,
    "variants.$.weightGrams": updatedVariant.weightGrams,
    "variants.$.attributes": updatedVariant.attributes,
    "variants.$.label": updatedVariant.label,
    // ARCHITECTURE §3: variant edits recompute the denormalized `filter` block.
    filter: deriveFilter(product.variants.map((v) => (v.sku === sku ? updatedVariant : v))),
  };

  // Issue #13: never overwrite stock that changed since the editor loaded it. Saving
  // unrelated fields leaves `stock` untouched; an explicit stock edit is applied
  // conditionally on the loaded value and refused on a conflict.
  const condition: Record<string, unknown> = stockEdited
    ? { _id: product._id, variants: { $elemMatch: { sku, stock: expectedStock } } }
    : { _id: product._id, variants: { $elemMatch: { sku } } };
  if (stockEdited) set["variants.$.stock"] = stock;

  const result = await ProductModel.updateOne(condition, { $set: set });
  if (result.matchedCount === 0) {
    return {
      ok: false,
      error: `Der Lagerbestand von ${sku} hat sich seit dem Laden geändert. Bitte Seite neu laden und erneut speichern.`,
    };
  }
  return { ok: true };
}

export async function updateImagesCore(productId: string, input: unknown): Promise<ProductAdminResult> {
  const parsed = productImagesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  if (!mongoose.isValidObjectId(productId)) return { ok: false, error: "Produkt nicht gefunden." };

  const result = await ProductModel.updateOne(
    { _id: productId },
    { $set: { images: parsed.data.images } },
  );
  if (result.matchedCount === 0) return { ok: false, error: "Produkt nicht gefunden." };
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
