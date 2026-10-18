import type { Metadata } from "next";
import { connection } from "next/server";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransition } from "@/components/storefront/route-transition";
import { LabelsProvider, LabelsSync } from "@/components/labels";
import { LocaleFormattersProvider, LocaleSync } from "@/components/locale-formatters";
import { getIntlLocale, getLabels, getRequestLanguage } from "@/server/i18n";
import { SITE_METADATA_BASE, siteMetadata } from "../site-metadata";
import { geistSans, geistMono } from "../fonts";
import "../globals.css";

// Issue #58 step 2: the admin keeps its own root layout — it is prefix-free and stays
// so (#63); issue #58 step 3 (admin slice): it follows the shared `lang` cookie through
// getRequestLanguage(). Admin requests carry no x-language header (the proxy's admin
// gate passes them through without one), so the precedence is cookie > Accept-Language
// > first active row: the language chosen on the storefront is remembered here, and the
// switcher in the sidebar writes the very same cookie.
// #58 step 3: the metadata reads the same language's rows (login-page pattern, #37
// rule) — the admin's tab title and Open Graph pair answer in the admin's language.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const lang = await getRequestLanguage();
  const [labels, intlLocale] = await Promise.all([getLabels(lang), getIntlLocale(lang)]);
  const site = siteMetadata(labels);
  return {
    ...SITE_METADATA_BASE,
    ...site,
    openGraph: { ...SITE_METADATA_BASE.openGraph, ...site.openGraph, locale: intlLocale.replace("-", "_") },
    robots: { index: false, follow: false },
  };
}

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  // The admin is fully dynamic anyway (proxy gate + requireAdminSession per request);
  // connection() keeps the language and the table read out of the prerender stage.
  await connection();
  const lang = await getRequestLanguage();
  const labels = await getLabels(lang);
  // #58 admin formats slice: amounts, dates and weights follow the same language row —
  // the admin is fully dynamic, so the live locale goes straight into the sync.
  const intlLocale = await getIntlLocale(lang);
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LabelsProvider lang={lang}>
            <LabelsSync labels={labels} />
            <LocaleFormattersProvider lang={lang}>
              <LocaleSync intlLocale={intlLocale} />
              <RouteTransition>{children}</RouteTransition>
            </LocaleFormattersProvider>
          </LabelsProvider>
          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
