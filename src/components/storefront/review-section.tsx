import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createFormatters } from "@/lib/format";
import { interpolate, label, plural } from "@/lib/i18n";
import { getProductReviewsCore, getUserReviewCore, hasPurchasedCore } from "@/server/reviews";
import { getCustomerSessionUserId } from "@/server/session";
import type { ProductDto } from "@/server/search";
import { ReviewForm } from "./review-form";
import { StarRating } from "./star-rating";

// Reviews section on the product page (issue #47): average + distribution over the
// approved reviews, the reviews themselves (every one a verified purchase), and — for
// a logged-in buyer who has not reviewed yet — the submission form.
// Issue #58 step 3: every text comes from the translation table, resolved to the
// request language by the page.
export async function ReviewSection({
  product,
  intlLocale,
  labels,
}: {
  product: ProductDto;
  // Issue #58 step 2b: review dates follow the request language's Intl locale.
  intlLocale: string;
  labels: Record<string, string>;
}) {
  const { date, number } = createFormatters(intlLocale);
  const { aggregate, reviews } = await getProductReviewsCore(product.id);
  const userId = await getCustomerSessionUserId();
  const [ownReview, purchased] = userId
    ? await Promise.all([
        getUserReviewCore(userId, product.id),
        hasPurchasedCore(userId, product.id),
      ])
    : [null, false];

  return (
    <section className="mt-12 border-t pt-8" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-xl font-semibold tracking-tight">
        {label(labels, "shop.reviews.title")}
      </h2>

      {aggregate.count > 0 && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <p className="text-4xl font-bold">{number(aggregate.average)}</p>
            <div>
              <StarRating value={aggregate.average} size="lg" />
              <p className="mt-0.5 text-sm text-muted-foreground">
                {interpolate(
                  plural(labels, aggregate.count, "shop.reviews.count", intlLocale),
                  { count: aggregate.count },
                )}
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-1 sm:max-w-xs">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = aggregate.distribution[stars - 1];
              const share = aggregate.count === 0 ? 0 : Math.round((count / aggregate.count) * 100);
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-muted-foreground">{stars} ★</span>
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={interpolate(label(labels, "shop.reviews.distributionAria"), {
                      count,
                      total: aggregate.count,
                      stars,
                    })}
                  >
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${share}%` }} />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviews.length === 0 && aggregate.count === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{label(labels, "shop.reviews.none")}</p>
      )}

      <ul className="mt-6 space-y-6">
        {reviews.map((review) => (
          <li key={review.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StarRating value={review.rating} />
              {review.title && <p className="font-medium">{review.title}</p>}
              <Badge variant="secondary" className="gap-1">
                <BadgeCheck className="size-3" aria-hidden />
                {label(labels, "shop.reviews.verified")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {review.authorName}, {date(new Date(review.createdAt))}
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
            {review.adminReply && (
              <div className="mt-2 rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold">{label(labels, "shop.reviews.reply")}</p>
                <p className="mt-1 whitespace-pre-line text-sm">{review.adminReply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8 max-w-xl">
        {ownReview ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground" role="status">
            {ownReview.status === "pending"
              ? label(labels, "shop.reviews.pending")
              : label(labels, "shop.reviews.done")}
          </p>
        ) : purchased ? (
          <ReviewForm productId={product.id} productName={product.name} />
        ) : (
          <p className="text-sm text-muted-foreground">{label(labels, "shop.reviews.buyersOnly")}</p>
        )}
      </div>
    </section>
  );
}
