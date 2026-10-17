import { Suspense } from "react";
import { connection } from "next/server";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartProvider } from "@/components/storefront/cart-provider";
import { LocalStoreHydrator } from "@/components/storefront/local-store-hydrator";
import { WishlistSync } from "@/components/storefront/wishlist-sync";
import { getCustomerSessionUserId } from "@/server/session";

// Issue #46: only a logged-in customer has an account wishlist to sync into; guests
// keep the browser list. The session check is a dynamic hole inside Suspense so the
// static shell of every storefront page survives (same PPR rule as the product page).
async function WishlistSyncGate() {
  // Issue #37 rule: unwrap the request before touching cookies()/the DB, or the
  // session check runs in the prerender stage and trips the unstable-value guard.
  await connection();
  return (await getCustomerSessionUserId()) !== null ? <WishlistSync /> : null;
}

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <LocalStoreHydrator />
      <Suspense fallback={null}>
        <WishlistSyncGate />
      </Suspense>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md focus:outline-2 focus:outline-ring"
      >
        Zum Inhalt springen
      </a>
      <Header />
      <CartDrawer />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </CartProvider>
  );
}
