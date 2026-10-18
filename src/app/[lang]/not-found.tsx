import type { Metadata } from "next";
import { lang } from "next/root-params";
import { connection } from "next/server";
import { BASE_LANGUAGE, label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { NotFoundContent } from "@/components/not-found-content";

// #58: the title follows the request language (the account-layout generateMetadata
// pattern) — the page already resolves the language from the [lang] segment.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await lang()) ?? BASE_LANGUAGE);
  return {
    title: label(labels, "shop.meta.notFound.title"),
    description: label(labels, "shop.meta.notFound.description"),
    robots: { index: false, follow: false },
  };
}

export default async function NotFound() {
  const code = await lang();
  return <NotFoundContent homeHref={`/${code}`} listingHref={`/${code}/products`} />;
}
