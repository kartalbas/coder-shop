import mongoose, { Schema, type Types } from "mongoose";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/reviews";

// Product reviews (issue #47): one per (product, buyer) — only customers who bought
// the product may submit one, so every review is a verified purchase. New reviews are
// `pending` until an admin approves or hides them; only `approved` ones count toward
// the product's rating.
export interface Review {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  // The buyer's display name at submission time — the review keeps it even if the
  // account changes later.
  authorName: string;
  rating: number; // 1–5
  title?: string;
  body: string;
  status: ReviewStatus;
  adminReply?: string;
  adminRepliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<Review>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 120 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: REVIEW_STATUSES, required: true, default: "pending" },
    adminReply: { type: String, trim: true, maxlength: 2000 },
    adminRepliedAt: { type: Date },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);
// One review per buyer and product — the unique index is the race-safe guarantee.
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1 });
reviewSchema.index({ status: 1, createdAt: -1 });

export const ReviewModel =
  mongoose.models.Review ?? mongoose.model<Review>("Review", reviewSchema);
