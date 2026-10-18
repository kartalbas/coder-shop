export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { CartPageView } from "@/components/storefront/cart-page-view";
import { vatLabel } from "@/lib/shop-settings";
import { getShopSettings } from "@/server/shop-settings";
import { getLabels } from "@/server/i18n";
import { interpolate, label } from "@/lib/i18n";

// Issue #58 step 3: metadata texts from the translation table, VAT label interpolated.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/cart">): Promise<Metadata> {
  await connection();
  const [settings, labels] = await Promise.all([
    getShopSettings(),
    getLabels((await params).lang),
  ]);
  return {
    title: label(labels, "shop.meta.cart.title"),
    description: interpolate(label(labels, "shop.meta.cart.description"), {
      vat: vatLabel(settings.vatRatePercent),
    }),
  };
}

export default function CartPage() {
  return <CartPageView />;
}
