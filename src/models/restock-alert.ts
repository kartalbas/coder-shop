import mongoose, { Schema } from "mongoose";

// "Benachrichtigen, wenn wieder verfügbar" (issue #46): one document per (sku, e-mail)
// — the _id `sku|email` makes double subscriptions idempotent. `notifiedAt` is stamped
// when the restock mail goes out, so every address is notified at most once per sell-out.
export interface RestockAlert {
  _id: string;
  sku: string;
  email: string;
  productSlug: string;
  variantLabel: string;
  createdAt: Date;
  notifiedAt?: Date;
}

const restockAlertSchema = new Schema<RestockAlert>(
  {
    _id: { type: String },
    sku: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    productSlug: { type: String, required: true },
    variantLabel: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    notifiedAt: { type: Date },
  },
  { versionKey: false },
);
restockAlertSchema.index({ sku: 1, notifiedAt: 1 });

export const RestockAlertModel =
  mongoose.models.RestockAlert ??
  mongoose.model<RestockAlert>("RestockAlert", restockAlertSchema);
