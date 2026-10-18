import type { Metadata } from "next";
import { connection } from "next/server";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransition } from "@/components/storefront/route-transition";
import { LabelsProvider, LabelsSync } from "@/components/labels";
import { getLabels, getRequestLanguage } from "@/server/i18n";
import { SITE_METADATA_BASE } from "../site-metadata";
import { geistSans, geistMono } from "../fonts";
import "../globals.css";

// Issue #58 step 2: the admin keeps its own root layout — it is prefix-free and stays
// so (#63); issue #58 step 3 (admin slice): it follows the shared `lang` cookie through
// getRequestLanguage(). Admin requests carry no x-language header (the proxy's admin
// gate passes them through without one), so the precedence is cookie > Accept-Language
// > first active row: the language chosen on the storefront is remembered here, and the
// switcher in the sidebar writes the very same cookie.
export const metadata: Metadata = {
  ...SITE_METADATA_BASE,
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  // The admin is fully dynamic anyway (proxy gate + requireAdminSession per request);
  // connection() keeps the language and the table read out of the prerender stage.
  await connection();
  const lang = await getRequestLanguage();
  const labels = await getLabels(lang);
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
            <RouteTransition>{children}</RouteTransition>
          </LabelsProvider>
          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
