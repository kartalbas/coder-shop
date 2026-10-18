import type { Metadata } from "next";
import { lang } from "next/root-params";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const code = await lang();
  return <NotFoundContent homeHref={`/${code}`} listingHref={`/${code}/products`} />;
}
