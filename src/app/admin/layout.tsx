import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransition } from "@/components/storefront/route-transition";
import { BASE_LANGUAGE } from "@/lib/i18n";
import { SITE_METADATA_BASE } from "../site-metadata";
import { geistSans, geistMono } from "../fonts";
import "../globals.css";

// Issue #58 step 2: the admin keeps its own root layout — it is prefix-free (its UI
// strings live in the translation table only since step 3, so a switcher there would
// have nothing to switch). German is the base language of the admin.
export const metadata: Metadata = {
  ...SITE_METADATA_BASE,
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html
      lang={BASE_LANGUAGE}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RouteTransition>{children}</RouteTransition>
          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
