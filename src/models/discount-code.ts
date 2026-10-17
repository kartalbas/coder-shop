import mongoose, { Schema, type Types } from "mongoose";
import type { DiscountKind } from "@/lib/discounts";

// Marketing discount codes (issue #45): percentage or fixed reduction with a minimum
// order, a validity window, an overall usage limit and an optional once-per-customer
// rule. `usedCount` is incremented atomically inside the checkout transaction.
export interface DiscountCode {
  _id: Types.ObjectId;
  code: string; // stored upper-case, entered by marketing
  description?: string;
  kind: DiscountKind;
  percent?: number; // 1–100, kind === "percent"
  amountCents?: number; // kind === "fixed"
  minOrderCents: number;
  validFrom?: Date;
  validTo?: Date;
  usageLimit?: number; // total redemptions; unset = unlimited
  usedCount: number;
  perCustomerOnce: boolean;
  active: boolean;
  createdAt: Date;
}

const discountCodeSchema = new Schema<DiscountCode>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 200 },
    kind: { type: String, enum: ["percent", "fixed"], required: true },
    percent: { type: Number, min: 1, max: 100 },
    amountCents: { type: Number, min: 1 },
    minOrderCents: { type: Number, min: 0, default: 0 },
    validFrom: { type: Date },
    validTo: { type: Date },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, required: true, default: 0 },
    perCustomerOnce: { type: Boolean, required: true, default: false },
    active: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);
discountCodeSchema.index({ code: 1 }, { unique: true });

export const DiscountCodeModel =
  mongoose.models.DiscountCode ??
  mongoose.model<DiscountCode>("DiscountCode", discountCodeSchema);
