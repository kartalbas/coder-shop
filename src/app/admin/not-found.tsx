import type { Metadata } from "next";
import { connection } from "next/server";
import { BASE_LANGUAGE } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

// The admin is German (prefix-free, #58 step 2) — it renders the 404 content with the
// base-language label map; `connection()` reads the table per request instead of in
// the prerender stage (#37 rule), and `instant = false` only opts this 404 boundary
// out of the instant/static-shell validation.
export const instant = false;

export default async function NotFound() {
  await connection();
  const labels = await getLabels(BASE_LANGUAGE);
  return <NotFoundContent homeHref="/admin" listingHref="/admin/products" labels={labels} />;
}
