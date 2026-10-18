import type { Metadata } from "next";
import { connection } from "next/server";
import { getRequestLabels } from "@/server/i18n";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

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
