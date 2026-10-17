import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RouteTransition } from "@/components/storefront/route-transition";
import "./globals.css";
import { VAT_LABEL } from "@/lib/pricing";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "coder-shop — Smartphones, Schuhe & Kleidung",
    template: "%s | coder-shop",
  },
  description:
    `Premium-Onlineshop für Smartphones, Schuhe und Kleidung. Preise in CHF inklusive ${VAT_LABEL}.`,
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: siteUrl,
    siteName: "coder-shop",
    title: "coder-shop — Smartphones, Schuhe & Kleidung",
    description:
      `Premium-Onlineshop für Smartphones, Schuhe und Kleidung. Preise in CHF inklusive ${VAT_LABEL}.`,
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
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
