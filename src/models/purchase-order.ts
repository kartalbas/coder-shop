import mongoose, { Schema, type Types } from "mongoose";

import type { PurchaseOrderStatus } from "@/lib/purchasing/labels";

export type { PurchaseOrderStatus };

interface PurchaseOrderLine {
  productId: Types.ObjectId;
  sku: string;
  qty: number;
  unitPriceCents: number;
  received: number;
}

export interface PurchaseOrder {
  _id: Types.ObjectId;
  poNumber: string;
  supplierId: Types.ObjectId;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  totalCents: number;
  orderedAt?: Date;
  // Issue #62 (#55): expected arrival, set from the supplier lead time when the PO is
  // ordered and editable per PO.
  expectedArrivalAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}


const lineSchema = new Schema<PurchaseOrderLine>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    received: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema<PurchaseOrder>(
  {
    poNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    status: { type: String, enum: ["draft", "ordered", "received"], required: true },
    lines: { type: [lineSchema], required: true },
    totalCents: { type: Number, required: true, min: 0 },
    orderedAt: { type: Date },
    expectedArrivalAt: { type: Date },
    receivedAt: { type: Date },
  },
  { versionKey: false, timestamps: true },
);

purchaseOrderSchema.index({ poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ status: 1, createdAt: -1 });

export const PurchaseOrderModel =
  mongoose.models.PurchaseOrder ?? mongoose.model<PurchaseOrder>("PurchaseOrder", purchaseOrderSchema);
