import type { Metadata } from "next";
import type { LabelMap } from "@/lib/i18n";
import { label } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

// Issue #58: the two root layouts (storefront `app/[lang]`, admin `app/admin`) share one
// metadata base; each extends it with what is specific to its routes.
//
// #58 step 3: the base holds no texts anymore — the site title and description are
// `shop.meta.site.*` rows, so every language's metadata answers in its own words
// (`siteMetadata()` below). What stays code is structure: the origin, the tab-title
// template and the robots policy.
// The tab-title suffix every page carries. The root layouts apply it as a metadata
// template; the global `/_not-found` renders outside both root layouts and composes
// its title with `titled()` instead (#58 review).
const TITLE_TEMPLATE = "%s | coder-shop";

export function titled(title: string): string {
  return TITLE_TEMPLATE.replace("%s", title);
}

export const SITE_METADATA_BASE: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "coder-shop",
  },
  robots: { index: true, follow: true },
};

// The request language's site-wide title, description and Open Graph pair (#58 step 3)
// — the two root layouts merge this over SITE_METADATA_BASE behind `connection()`.
export function siteMetadata(labels: LabelMap): Metadata {
  const title = label(labels, "shop.meta.site.title");
  const description = label(labels, "shop.meta.site.description");
  return {
    title: { default: title, template: TITLE_TEMPLATE },
    description,
    openGraph: { title, description },
  };
}
