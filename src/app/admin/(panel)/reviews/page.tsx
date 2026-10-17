export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ReviewActions } from "@/components/admin/review-actions";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/storefront/star-rating";
import { formatDate } from "@/lib/format";
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, type ReviewStatus } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { listReviewsCore, type AdminReviewFilter } from "@/server/reviews";

export const metadata: Metadata = {
  title: "Bewertungen — Admin",
  description: "Kundenbewertungen prüfen, freigeben, verstecken und beantworten.",
};

const TABS: { filter: AdminReviewFilter; label: string }[] = [
  { filter: "all", label: "Alle" },
  ...REVIEW_STATUSES.map((status) => ({ filter: status as AdminReviewFilter, label: REVIEW_STATUS_LABELS[status] })),
];

function activeFilter(raw: string | undefined): AdminReviewFilter {
  return TABS.some((tab) => tab.filter === raw) ? (raw as AdminReviewFilter) : "all";
}

const STATUS_TONES: Record<ReviewStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  hidden: "bg-muted text-muted-foreground",
};

async function ReviewsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : undefined;
  const filter = activeFilter(raw);
  const reviews = await listReviewsCore(filter);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Bewertungen</h1>

      <nav className="mt-4 flex flex-wrap gap-1 border-b" aria-label="Statusfilter">
        {TABS.map(({ filter: tab, label }) => (
          <Link
            key={tab}
            href={tab === "all" ? "/admin/reviews" : `/admin/reviews?status=${tab}`}
            aria-current={tab === filter ? "page" : undefined}
            className={cn(
              "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              tab === filter
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          Keine Bewertungen in dieser Ansicht.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StarRating value={review.rating} />
                {review.title && <p className="font-medium">{review.title}</p>}
                <Badge variant="outline" className={STATUS_TONES[review.status]}>
                  {REVIEW_STATUS_LABELS[review.status]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {review.authorName} ·{" "}
                <a
                  href={`/products/${review.productSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
                >
                  {review.productName}
                </a>{" "}
                · {formatDate(new Date(review.createdAt))}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm">{review.body}</p>
              {review.adminReply && (
                <p className="mt-2 rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold">Antwort: </span>
                  {review.adminReply}
                </p>
              )}
              <div className="mt-3">
                <ReviewActions reviewId={review.id} status={review.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReviewsView searchParams={searchParams} />;
}
