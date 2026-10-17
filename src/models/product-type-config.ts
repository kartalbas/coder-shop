import mongoose, { Schema, type Types } from "mongoose";
import type { CatalogTypeConfig, StockTracking } from "@/lib/catalog-types";

// Issue #61: the catalog's types, variant dimensions and facets are this collection —
// generic code reads it, so a new type or attribute needs no code change.
export interface ProductTypeConfigDocument {
  _id: Types.ObjectId;
  key: string;
  label: string;
  position: number;
  stockTracking: StockTracking;
  comparable: boolean;
  photoNoun: string;
  brands: string[];
  dimensions: {
    key: string;
    label: string;
    facet: boolean;
    order: "alpha" | "numeric" | "clothing-size";
    unit?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const dimensionSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    facet: { type: Boolean, required: true, default: false },
    order: { type: String, enum: ["alpha", "numeric", "clothing-size"], required: true },
    unit: { type: String },
  },
  { _id: false },
);

const productTypeConfigSchema = new Schema<ProductTypeConfigDocument>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    position: { type: Number, required: true, default: 0 },
    stockTracking: { type: String, enum: ["quantity", "serial"], required: true, default: "quantity" },
    comparable: { type: Boolean, required: true, default: false },
    photoNoun: { type: String, required: true, default: "product" },
    brands: { type: [String], default: [] },
    dimensions: { type: [dimensionSchema], required: true },
  },
  { versionKey: false, timestamps: true },
);

productTypeConfigSchema.index({ key: 1 }, { unique: true });
productTypeConfigSchema.index({ position: 1 });

export const ProductTypeConfigModel =
  mongoose.models.ProductTypeConfig ??
  mongoose.model<ProductTypeConfigDocument>("ProductTypeConfig", productTypeConfigSchema);

export function toCatalogTypeConfig(doc: ProductTypeConfigDocument): CatalogTypeConfig {
  return {
    key: doc.key,
    label: doc.label,
    position: doc.position,
    stockTracking: doc.stockTracking,
    comparable: doc.comparable,
    photoNoun: doc.photoNoun,
    brands: [...doc.brands],
    dimensions: doc.dimensions.map((d) => ({
      key: d.key,
      label: d.label,
      facet: d.facet,
      order: d.order,
      ...(d.unit ? { unit: d.unit } : {}),
    })),
  };
}
