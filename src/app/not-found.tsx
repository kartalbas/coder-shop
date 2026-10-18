import type { Metadata } from "next";
import { NotFoundContent } from "@/components/not-found-content";

// Issue #58: the proxy answers unknown products with a real HTTP 404 by rewriting to the
// internal `/_not-found` route (PPR pages can only stream 200, #28) — this global page
// backs that route. Its links are prefix-free; the proxy localizes them on navigation.
export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundContent homeHref="/" listingHref="/products" />;
}
