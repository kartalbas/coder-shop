import type { Metadata } from "next";
import { connection } from "next/server";
import { label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { NotFoundContent } from "@/components/not-found-content";
import { titled } from "@/app/site-metadata";

// Issue #58: the proxy answers unknown products with a real HTTP 404 by rewriting to the
// internal `/_not-found` route (PPR pages can only stream 200, #28) — this global page
// backs that route, and every unmatched URL renders it too. Its links are prefix-free;
// the proxy localizes them on navigation. #58 review: title and copy follow the request
// language (URL prefix header > cookie > Accept-Language > first active row, the
// getRequestLanguage pattern). `connection()` keeps title and copy out of the
// prerendered shell so they resolve per request (#37 rule — on a cold server this
// render is the first DB access); `instant = false` only opts the route out of the
// instant/static-shell validation, which a 404 boundary cannot satisfy.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: titled(label(labels, "shop.meta.notFound.title")),
    description: label(labels, "shop.meta.notFound.description"),
    robots: { index: false, follow: false },
  };
}

export default async function NotFound() {
  await connection();
  const labels = await getRequestLabels();
  return <NotFoundContent homeHref="/" listingHref="/products" labels={labels} />;
}
