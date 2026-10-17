import type { Metadata } from "next";
import { CartPageView } from "@/components/storefront/cart-page-view";
import { VAT_LABEL } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Warenkorb",
  description: `Ihr Warenkorb — coder-shop. Preise in CHF inklusive ${VAT_LABEL}.`,
};

export default function CartPage() {
  return <CartPageView />;
}
