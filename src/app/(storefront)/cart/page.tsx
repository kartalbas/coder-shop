import type { Metadata } from "next";
import { CartPageView } from "@/components/storefront/cart-page-view";

export const metadata: Metadata = {
  title: "Warenkorb",
  description: "Ihr Warenkorb — coder-shop. Preise in CHF inklusive 8,1 % MwSt.",
};

export default function CartPage() {
  return <CartPageView />;
}
