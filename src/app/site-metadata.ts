import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

// Issue #58: the two root layouts (storefront `app/[lang]`, admin `app/admin`) share one
// metadata base; each extends it with what is specific to its routes.
//
// The site-wide fallback description stays static (it also serves the prerendered 404);
// the pages that render product data carry the configured VAT wording in their own
// metadata (issues #37/#64).
export const SITE_METADATA_BASE: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "coder-shop — Smartphones, Schuhe & Kleidung",
    template: "%s | coder-shop",
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
