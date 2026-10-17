import mongoose, { Schema } from "mongoose";

// One document per submitted checkout (issue #15): the _id is a fingerprint of the
// payload, so a double submit can claim it only once and thus creates at most one order.
// The TTL index keeps the collection empty; claims older than an hour are irrelevant.
export interface CheckoutClaim {
  _id: string;
  orderNumber: string | null;
  createdAt: Date;
}

const checkoutClaimSchema = new Schema<CheckoutClaim>(
  {
    _id: { type: String },
    orderNumber: { type: String, default: null },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);
checkoutClaimSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export const CheckoutClaimModel =
  mongoose.models.CheckoutClaim ??
  mongoose.model<CheckoutClaim>("CheckoutClaim", checkoutClaimSchema);
