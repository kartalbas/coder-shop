import mongoose, { Schema } from "mongoose";

// One document per (code, customer) redemption (issue #43's cousin #45): the _id is
// `code|customerKey` (customerKey = userId or e-mail), so the unique index enforces
// "once per customer" inside the checkout transaction, and the collection doubles as
// the per-code usage statistic.
export interface DiscountUsage {
  _id: string;
  code: string;
  customerKey: string;
  orderNumber: string;
  at: Date;
}

const discountUsageSchema = new Schema<DiscountUsage>(
  {
    _id: { type: String },
    code: { type: String, required: true },
    customerKey: { type: String, required: true },
    orderNumber: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);
discountUsageSchema.index({ code: 1 });

export const DiscountUsageModel =
  mongoose.models.DiscountUsage ??
  mongoose.model<DiscountUsage>("DiscountUsage", discountUsageSchema);
