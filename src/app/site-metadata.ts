import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

// Issue #58: the two root layouts (storefront `app/[lang]`, admin `app/admin`) share one
// metadata base; each extends it with what is specific to its routes.
//
// The site-wide fallback description stays static (it also serves the prerendered 404);
// the pages that render product data carry the configured VAT wording in their own
// metadata (issues #37/#64).
// The tab-title suffix every page carries. The root layouts apply it as a metadata
// template; the global `/_not-found` renders outside both root layouts and composes
// its title with `titled()` instead (#58 review).
const TITLE_TEMPLATE = "%s | coder-shop";

export function titled(title: string): string {
  return TITLE_TEMPLATE.replace("%s", title);
}

export const SITE_METADATA_BASE: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "coder-shop — Smartphones, Schuhe & Kleidung",
    template: TITLE_TEMPLATE,
  },
  description: "Premium-Onlineshop. Preise in CHF inklusive MwSt.",
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: SITE_URL,
    siteName: "coder-shop",
    title: "coder-shop — Smartphones, Schuhe & Kleidung",
    description: "Premium-Onlineshop. Preise in CHF inklusive MwSt.",
  },
  robots: { index: true, follow: true },
};
