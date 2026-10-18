import { Types } from "mongoose";
import { label } from "@/lib/i18n";
import { ProductModel } from "@/models/product";
import { ReviewModel, type Review } from "@/models/review";
import { UserModel } from "@/models/user";
import { OrderModel } from "@/models/order";
import { aggregateRating, PURCHASED_ORDER_STATUS_LIST, type ReviewStatus } from "@/lib/reviews";
import { connectDB } from "./db";
import { getRequestLabels } from "./i18n";

// Product reviews (issue #47). Only customers who bought the product may submit a
// review (verified purchase), new reviews are `pending` until an admin moderates
// them, and only `approved` ones are public and count toward the rating — which is
// denormalized onto the product document for cards, sorting and JSON-LD.

export type ReviewResult = { ok: true } | { ok: false; error: string };

export interface ReviewDto {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  adminReply: string | null;
  status: ReviewStatus;
  createdAt: string;
}

export interface ProductReviews {
  aggregate: ReturnType<typeof aggregateRating>;
  reviews: ReviewDto[];
}

function toReviewDto(review: Review & { _id: Types.ObjectId }): ReviewDto {
  return {
    id: String(review._id),
    rating: review.rating,
    title: review.title ?? null,
    body: review.body,
    authorName: review.authorName,
    adminReply: review.adminReply ?? null,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
  };
}

// Recompute the product's denormalized rating from its approved reviews.
async function recomputeProductRatingCore(productId: string): Promise<void> {
  await connectDB();
  const ratings = await ReviewModel.find({ productId, status: "approved" })
    .select("rating")
    .lean<Pick<Review, "rating">[]>()
    .exec();
  const aggregate = aggregateRating(ratings.map((review) => review.rating));
  await ProductModel.updateOne(
    { _id: productId },
    { $set: { "rating.average": aggregate.average, "rating.count": aggregate.count } },
  );
}

// The statuses that prove a purchase are the pure rule (#47); here the DB question.
export async function hasPurchasedCore(userId: string, productId: string): Promise<boolean> {
  await connectDB();
  const found = await OrderModel.exists({
    userId,
    "lines.productId": productId,
    status: { $in: [...PURCHASED_ORDER_STATUS_LIST] },
  });
  return found !== null;
}

export async function getUserReviewCore(
  userId: string,
  productId: string,
): Promise<ReviewDto | null> {
  await connectDB();
  const review = await ReviewModel.findOne({ userId, productId }).lean().exec();
  return review ? toReviewDto(review) : null;
}

export interface SubmitReviewInput {
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  body: string;
}

export async function submitReviewCore(
  input: SubmitReviewInput,
): Promise<ReviewResult & { slug?: string }> {
  const labels = await getRequestLabels();
  await connectDB();
  if (!Types.ObjectId.isValid(input.productId)) {
    return { ok: false, error: label(labels, "shop.review.error.productNotFound") };
  }
  const product = await ProductModel.findById(input.productId).select("slug").lean().exec();
  if (!product) return { ok: false, error: label(labels, "shop.review.error.productNotFound") };

  if (!(await hasPurchasedCore(input.userId, input.productId))) {
    return { ok: false, error: label(labels, "shop.review.error.buyersOnly") };
  }
  const user = await UserModel.findById(input.userId).select("name").lean().exec();
  if (!user) return { ok: false, error: label(labels, "shop.review.error.accountNotFound") };

  try {
    await ReviewModel.create({
      productId: input.productId,
      userId: input.userId,
      authorName: user.name,
      rating: input.rating,
      ...(input.title ? { title: input.title } : {}),
      body: input.body,
      status: "pending",
    });
  } catch (error) {
    // The unique (productId, userId) index makes the double-review race safe.
    if ((error as { code?: number }).code === 11000) {
      return { ok: false, error: label(labels, "shop.review.error.alreadyReviewed") };
    }
    throw error;
  }
  return { ok: true, slug: product.slug };
}

// Public view of one product: approved reviews, newest first, plus the aggregate.
export async function getProductReviewsCore(productId: string): Promise<ProductReviews> {
  await connectDB();
  const reviews = await ReviewModel.find({ productId, status: "approved" })
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .exec();
  return {
    aggregate: aggregateRating(reviews.map((review) => review.rating)),
    reviews: reviews.map(toReviewDto),
  };
}

export type AdminReviewFilter = ReviewStatus | "all";

export interface AdminReviewRow extends ReviewDto {
  productSlug: string;
  productName: string;
}

export async function listReviewsCore(filter: AdminReviewFilter): Promise<AdminReviewRow[]> {
  await connectDB();
  const reviews = await ReviewModel.find(filter === "all" ? {} : { status: filter })
    .sort({ createdAt: -1, _id: -1 })
    .limit(200)
    .lean()
    .exec();
  if (reviews.length === 0) return [];
  const products = await ProductModel.find({
    _id: { $in: [...new Set(reviews.map((review) => review.productId))] },
  })
    .select("slug name")
    .lean()
    .exec();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return reviews
    .filter((review) => byId.has(String(review.productId)))
    .map((review) => {
      const product = byId.get(String(review.productId))!;
      return {
        ...toReviewDto(review),
        status: review.status,
        productSlug: product.slug,
        productName: product.name,
      };
    });
}

export async function setReviewStatusCore(
  reviewId: string,
  status: ReviewStatus,
): Promise<ReviewResult> {
  await connectDB();
  if (!Types.ObjectId.isValid(reviewId)) return { ok: false, error: "Bewertung nicht gefunden." };
  const review = await ReviewModel.findById(reviewId).select("productId").lean().exec();
  if (!review) return { ok: false, error: "Bewertung nicht gefunden." };
  await ReviewModel.updateOne({ _id: reviewId }, { $set: { status } });
  await recomputeProductRatingCore(String(review.productId));
  return { ok: true };
}

export async function replyToReviewCore(reviewId: string, text: string): Promise<ReviewResult> {
  await connectDB();
  if (!Types.ObjectId.isValid(reviewId)) return { ok: false, error: "Bewertung nicht gefunden." };
  const updated = await ReviewModel.updateOne(
    { _id: reviewId },
    { $set: { adminReply: text, adminRepliedAt: new Date() } },
  ).exec();
  if (updated.matchedCount === 0) return { ok: false, error: "Bewertung nicht gefunden." };
  return { ok: true };
}
