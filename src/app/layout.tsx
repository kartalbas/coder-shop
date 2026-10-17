import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransition } from "@/components/storefront/route-transition";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The site-wide fallback description stays static (it also serves the prerendered 404);
// the pages that render product data carry the configured VAT wording in their own
// metadata (issues #37/#64).
export const metadata: Metadata = {
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
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
