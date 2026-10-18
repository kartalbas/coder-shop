import type { OrderStatus } from "@/lib/orders/state-machine";

// Review rules (issue #47) — pure: statuses, the purchase rule and the rating
// aggregation, no I/O.

export const REVIEW_STATUSES = ["pending", "approved", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// A review must come from a real purchase: an order that was cancelled, or one that
// was never paid and never collected (`new`), proves nothing.
const PURCHASED_ORDER_STATUSES: readonly OrderStatus[] = [
  "paid",
  "picking",
  "packed",
  "shipped",
  "delivered",
  "ready",
  "picked_up",
];

export const PURCHASED_ORDER_STATUS_LIST: readonly OrderStatus[] = PURCHASED_ORDER_STATUSES;

export function countsAsPurchase(status: OrderStatus): boolean {
  return PURCHASED_ORDER_STATUSES.includes(status);
}

export interface RatingAggregate {
  // Mean over the given ratings, one decimal; 0 when there is nothing to average.
  average: number;
  count: number;
  // Index 0..4 = stars 1..5.
  distribution: number[];
}

export function aggregateRating(ratings: number[]): RatingAggregate {
  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const rating of ratings) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    distribution[rating - 1] += 1;
    sum += rating;
  }
  const count = distribution.reduce((total, n) => total + n, 0);
  return {
    average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10,
    count,
    distribution,
  };
}
