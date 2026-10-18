import mongoose, { Schema, type Types } from "mongoose";
import {
  STOCK_UNIT_STATUSES,
  type StockUnitStatus,
} from "@/lib/stock-units";

// Issue #62 (#54): the unit ledger for serial-tracked types. One document per
// physical piece; `variant.stock` of such a variant is the count of its `in_stock`
// units, so every quantity-based reader keeps working.
interface StockUnitHistoryEntry {
  status: StockUnitStatus;
  at: Date;
  note?: string;
}

export interface StockUnit {
  _id: Types.ObjectId;
  sku: string;
  serial: string;
  status: StockUnitStatus;
  orderNumber?: string;
  purchaseOrderId?: Types.ObjectId;
  history: StockUnitHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const historySchema = new Schema<StockUnitHistoryEntry>(
  {
    status: { type: String, enum: STOCK_UNIT_STATUSES, required: true },
    at: { type: Date, required: true },
    note: { type: String },
  },
  { _id: false },
);

const stockUnitSchema = new Schema<StockUnit>(
  {
    sku: { type: String, required: true },
    serial: { type: String, required: true },
    status: { type: String, enum: STOCK_UNIT_STATUSES, required: true },
    orderNumber: { type: String },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder" },
    history: { type: [historySchema], required: true },
  },
  { versionKey: false, timestamps: true },
);

// A serial exists once per SKU — duplicates are refused by the index.
stockUnitSchema.index({ sku: 1, serial: 1 }, { unique: true });
stockUnitSchema.index({ sku: 1, status: 1 });
stockUnitSchema.index({ orderNumber: 1 });
stockUnitSchema.index({ status: 1, updatedAt: -1 });

export const StockUnitModel =
  mongoose.models.StockUnit ?? mongoose.model<StockUnit>("StockUnit", stockUnitSchema);
