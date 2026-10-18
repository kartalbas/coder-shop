import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createFormatters } from "@/lib/format";
import { getProductReviewsCore, getUserReviewCore, hasPurchasedCore } from "@/server/reviews";
import { getCustomerSessionUserId } from "@/server/session";
import type { ProductDto } from "@/server/search";
import { ReviewForm } from "./review-form";
import { StarRating } from "./star-rating";

// Reviews section on the product page (issue #47): average + distribution over the
// approved reviews, the reviews themselves (every one a verified purchase), and — for
// a logged-in buyer who has not reviewed yet — the submission form.
export async function ReviewSection({
  product,
  intlLocale,
}: {
  product: ProductDto;
  // Issue #58 step 2b: review dates follow the request language's Intl locale.
  intlLocale: string;
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
        Bewertungen
      </h2>

      {aggregate.count > 0 && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <p className="text-4xl font-bold">{number(aggregate.average)}</p>
            <div>
              <StarRating value={aggregate.average} size="lg" />
              <p className="mt-0.5 text-sm text-muted-foreground">
                {aggregate.count} {aggregate.count === 1 ? "Bewertung" : "Bewertungen"}
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
                    aria-label={`${count} von ${aggregate.count} Bewertungen mit ${stars} Sternen`}
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
        <p className="mt-4 text-sm text-muted-foreground">
          Noch keine Bewertungen — kaufen Sie dieses Produkt und seien Sie die erste Person,
          die es bewertet.
        </p>
      )}

      <ul className="mt-6 space-y-6">
        {reviews.map((review) => (
          <li key={review.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StarRating value={review.rating} />
              {review.title && <p className="font-medium">{review.title}</p>}
              <Badge variant="secondary" className="gap-1">
                <BadgeCheck className="size-3" aria-hidden />
                Verifizierter Kauf
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {review.authorName}, {date(new Date(review.createdAt))}
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
            {review.adminReply && (
              <div className="mt-2 rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold">Antwort vom coder-shop</p>
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
              ? "Vielen Dank! Ihre Bewertung ist eingereicht und wird in Kürze freigeschaltet."
              : "Sie haben dieses Produkt bereits bewertet — vielen Dank!"}
          </p>
        ) : purchased ? (
          <ReviewForm productId={product.id} productName={product.name} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Bewertungen können nur Kundinnen und Kunden schreiben, die dieses Produkt gekauft
            haben.
          </p>
        )}
      </div>
    </section>
  );
}
