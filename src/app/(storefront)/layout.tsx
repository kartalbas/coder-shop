import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartProvider } from "@/components/storefront/cart-provider";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
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
