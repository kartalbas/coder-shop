import type { Metadata } from "next";
import { lang } from "next/root-params";
import { connection } from "next/server";
import { BASE_LANGUAGE, label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { NotFoundContent } from "@/components/not-found-content";

// #58: title and copy follow the request language (the account-layout generateMetadata
// pattern) — the page resolves the language from the [lang] segment. `connection()`
// reads the label table per request instead of in the prerender stage (#37 rule);
// `instant = false` only opts the 404 boundary out of the instant/static-shell
// validation, which it cannot satisfy.
export const instant = false;

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
  await connection();
  const code = (await lang()) ?? BASE_LANGUAGE;
  const labels = await getLabels(code);
  return <NotFoundContent homeHref={`/${code}`} listingHref={`/${code}/products`} labels={labels} />;
}
