import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransition } from "@/components/storefront/route-transition";
import { getLanguages } from "@/server/i18n";
import { BASE_LANGUAGE, DEFAULT_LANGUAGES } from "@/lib/i18n";
import { LOCALIZED_PATH_HEADER, localizedPath, splitLanguagePrefix } from "@/lib/locale-path";
import { absoluteUrl } from "@/lib/site";
import { SITE_METADATA_BASE } from "../site-metadata";
import { geistSans, geistMono } from "../fonts";
import "../globals.css";

// Issue #58 step 2: every storefront route lives under `app/[lang]`, so the language is a
// root segment (`/de/products`, `/fr/account/profile` — the path itself stays English in
// every language, #63). The proxy redirects prefix-free paths here and remembers the
// choice; a language is a `languages` row, so the prerendered set follows the seed
// content and a language added later simply renders dynamically (PPR).
export function generateStaticParams() {
  return DEFAULT_LANGUAGES.map((language) => ({ lang: language.code }));
}

// Per-language metadata: Open Graph locale follows the language row's intlLocale, and
// hreflang lists the same path in every active language plus x-default → the default
// language. The current English path arrives from the proxy as a request header; the
// whole function sits behind `connection()` (#37 rule), so the static shell survives and
// metadata streams with the dynamic part.
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  await connection();
  const [languages, headerList] = await Promise.all([getLanguages(), headers()]);
  const active = languages.filter((language) => language.active);
  const current = active.find((language) => language.code === lang);
  const { rest } = splitLanguagePrefix(
    headerList.get(LOCALIZED_PATH_HEADER) ?? "/",
    active.map((language) => language.code),
  );
  const fallback = active[0]?.code ?? BASE_LANGUAGE;
  return {
    ...SITE_METADATA_BASE,
    openGraph: {
      ...SITE_METADATA_BASE.openGraph,
      locale: (current?.intlLocale ?? "de-CH").replace("-", "_"),
    },
    alternates: {
      canonical: absoluteUrl(localizedPath(lang, rest)),
      languages: Object.fromEntries([
        ...active.map((language) => [
          language.code,
          absoluteUrl(localizedPath(language.code, rest)),
        ]),
        ["x-default", absoluteUrl(localizedPath(fallback, rest))],
      ]),
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RouteTransition>{children}</RouteTransition>
          {/* Issue #59: bottom-right sat on top of the cart drawer's and the cart
              summary's „Zur Kasse“ — bottom-center keeps them free. */}
          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
