export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { CartPageView } from "@/components/storefront/cart-page-view";
import { vatLabel } from "@/lib/shop-settings";
import { getShopSettings } from "@/server/shop-settings";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const settings = await getShopSettings();
  return {
    title: "Warenkorb",
    description: `Ihr Warenkorb — coder-shop. Preise in CHF inklusive ${vatLabel(settings.vatRatePercent)}`,
  };
}

export default function CartPage() {
  return <CartPageView />;
}
