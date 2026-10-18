import { Suspense } from "react";
import { connection } from "next/server";
import { menuCategories } from "@/lib/menu";
import { vatLabel } from "@/lib/shop-settings";
import { getCatalogTypes } from "@/server/catalog-types";
import { getShopSettings } from "@/server/shop-settings";
import { ShopSettingsProvider } from "@/components/shop-settings-provider";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartProvider } from "@/components/storefront/cart-provider";
import { LocalStoreHydrator } from "@/components/storefront/local-store-hydrator";
import { CompareTray } from "@/components/storefront/compare-tray";
import { WishlistSync } from "@/components/storefront/wishlist-sync";
import { getCustomerSessionUserId } from "@/server/session";
import { getActiveLanguages, getIntlLocale } from "@/server/i18n";
import {
  LocaleFormattersProvider,
  LocaleSync,
} from "@/components/storefront/locale-formatters";

// Issue #46: only a logged-in customer has an account wishlist to sync into; guests
// keep the browser list. The session check is a dynamic hole inside Suspense so the
// static shell of every storefront page survives (same PPR rule as the product page).
async function WishlistSyncGate() {
  // Issue #37 rule: unwrap the request before touching cookies()/the DB, or the
  // session check runs in the prerender stage and trips the unstable-value guard.
  await connection();
  return (await getCustomerSessionUserId()) !== null ? <WishlistSync /> : null;
}

// Issue #61: the category navigation is catalog configuration (data). It is read in a
// dynamic hole so the static shell of every storefront page survives; the fallbacks
// carry the exact header heights so nothing shifts when the real navigation streams in.
async function HeaderSlot() {
  await connection();
  const [types, languages] = await Promise.all([getCatalogTypes(), getActiveLanguages()]);
  return <Header categories={menuCategories(types)} languages={languages} />;
}

function HeaderSkeleton() {
  return (
    <header
      className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur"
      aria-hidden
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <span className="text-lg font-semibold tracking-tight text-transparent">coder-shop</span>
      </div>
      <div className="flex gap-1 border-t px-4 py-2 md:hidden">
        <span className="chip text-transparent">Kategorie</span>
      </div>
    </header>
  );
}

// Issue #58 step 2b: the live language row carries the Intl locale for numbers, CHF
// and dates. The provider above it already formats correctly from the seed
// configuration; this dynamic hole only syncs in an admin-edited intlLocale.
async function LocaleSlot({ lang }: { lang: string }) {
  await connection();
  return <LocaleSync intlLocale={await getIntlLocale(lang)} />;
}

async function FooterSlot() {
  await connection();
  const [types, settings] = await Promise.all([getCatalogTypes(), getShopSettings()]);
  return <Footer categories={menuCategories(types)} vatLabelText={vatLabel(settings.vatRatePercent)} />;
}

function FooterSkeleton() {
  return (
    <footer className="border-t bg-muted/40" aria-hidden>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="text-transparent">coder-shop — Preise in CHF inklusive MwSt.</div>
      </div>
      <p className="border-t py-4 text-center text-xs text-transparent">© coder-shop — Demo-Shop</p>
    </footer>
  );
}

export default async function StorefrontLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  return (
    <LocaleFormattersProvider lang={lang}>
    <ShopSettingsProvider>
    <CartProvider>
      <LocalStoreHydrator />
      <Suspense fallback={null}>
        <LocaleSlot lang={lang} />
      </Suspense>
      <CompareTray />
      <Suspense fallback={null}>
        <WishlistSyncGate />
      </Suspense>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md focus:outline-2 focus:outline-ring"
      >
        Zum Inhalt springen
      </a>
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderSlot />
      </Suspense>
      <CartDrawer />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Suspense fallback={<FooterSkeleton />}>
        <FooterSlot />
      </Suspense>
    </CartProvider>
    </ShopSettingsProvider>
    </LocaleFormattersProvider>
  );
}
