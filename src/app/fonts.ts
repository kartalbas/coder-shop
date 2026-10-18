import { Geist, Geist_Mono } from "next/font/google";

// Issue #58: the two root layouts (storefront `app/[lang]` and admin `app/admin`) share
// one font initialization — Next deduplicates font loaders across the build.
export const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
