import type { Metadata } from "next";
import { connection } from "next/server";
import { getRequestLabels } from "@/server/i18n";
import { label } from "@/lib/i18n";
import { NotFoundContent } from "@/components/not-found-content";

// #58 step 3: the title is the same `shop.meta.notFound.title` row the storefront 404
// uses — resolved per request language behind `connection()` (#37 rule); the admin
// layout's template appends the site suffix like on every page.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "shop.meta.notFound.title"),
    robots: { index: false, follow: false },
  };
}

// The admin stays prefix-free (#58 step 2) but follows the shared `lang` cookie
// (#58 admin slice) — the 404 answers in the remembered language too;
// `connection()` reads the table per request instead of in the prerender stage
// (#37 rule), and `instant = false` only opts this 404 boundary out of the
// instant/static-shell validation.
export const instant = false;

export default async function NotFound() {
  await connection();
  const labels = await getRequestLabels();
  return <NotFoundContent homeHref="/admin" listingHref="/admin/products" labels={labels} />;
}
