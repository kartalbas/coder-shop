import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartProvider } from "@/components/storefront/cart-provider";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <CartDrawer />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </CartProvider>
  );
}
