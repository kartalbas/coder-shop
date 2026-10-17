import mongoose, { Schema, type Types } from "mongoose";
import type { ProductAttributes, ProductFilter } from "@/lib/facets";
import type { ProductType } from "@/lib/product-types";

// Issue #35: the pure shapes live in src/lib; the model re-exports them for its consumers.
export type { ProductType };

interface ProductImage {
  src: string;
  alt: string;
}

export interface Variant {
  sku: string;
  label: string;
  priceDeltaCents: number;
  stock: number;
  restockThreshold: number;
  weightGrams: number;
  attributes: ProductAttributes;
}

export interface Product {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  type: ProductType;
  brand: string;
  priceCents: number;
  images: ProductImage[];
  featured: boolean;
  collection?: string;
  filter: ProductFilter;
  variants: Variant[];
  createdAt: Date;
  updatedAt: Date;
}


const imageSchema = new Schema<ProductImage>(
  { src: { type: String, required: true }, alt: { type: String, required: true } },
  { _id: false },
);

const attributesSchema = new Schema<ProductAttributes>(
  {
    color: { type: String, required: true },
    size: { type: String },
    storage: { type: Number },
    material: { type: String },
  },
  { _id: false },
);

const variantSchema = new Schema<Variant>(
  {
    sku: { type: String, required: true },
    label: { type: String, required: true },
    priceDeltaCents: { type: Number, required: true, default: 0 },
    stock: { type: Number, required: true, min: 0 },
    restockThreshold: { type: Number, required: true, min: 0 },
    weightGrams: { type: Number, required: true, min: 1 },
    attributes: { type: attributesSchema, required: true },
  },
  { _id: false },
);

const filterSchema = new Schema<ProductFilter>(
  {
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    storage: { type: [Number], default: [] },
    materials: { type: [String], default: [] },
  },
  { _id: false },
);

const productSchema = new Schema<Product>(
  {
    slug: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ["smartphone", "shoes", "clothing"], required: true },
    brand: { type: String, required: true },
    priceCents: { type: Number, required: true, min: 0 },
    images: { type: [imageSchema], required: true },
    featured: { type: Boolean, required: true, default: false },
    collection: { type: String },
    filter: { type: filterSchema, required: true },
    variants: { type: [variantSchema], required: true },
  },
  { versionKey: false, timestamps: true, suppressReservedKeysWarning: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ "variants.sku": 1 }, { unique: true });
productSchema.index({ type: 1, brand: 1 });
productSchema.index({ type: 1, "filter.sizes": 1 });
productSchema.index({ type: 1, "filter.storage": 1 });
productSchema.index({ type: 1, "filter.colors": 1 });
productSchema.index({ type: 1, "filter.materials": 1 });
productSchema.index({ type: 1, priceCents: 1 });
productSchema.index({ type: 1, createdAt: -1 });
productSchema.index({ featured: 1, type: 1 });

export const ProductModel =
  mongoose.models.Product ?? mongoose.model<Product>("Product", productSchema);
