export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { WishlistMergeOnVisit } from "@/components/storefront/wishlist-merge-on-visit";
import { WishlistRemoveButton } from "@/components/storefront/wishlist-remove-button";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { getWishlistProductsCore } from "@/server/wishlist";
import { requireCustomerSession } from "@/server/session";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/wishlist">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.account.nav.wishlist"),
    description: label(labels, "shop.meta.wishlist.description"),
    robots: { index: false },
  };
}

// The account's wishlist (issue #46): the browser list syncs into the account while
// logged in, so it survives logout/login and is available on every device.
export default async function WishlistPage({ params }: PageProps<"/[lang]/account/wishlist">) {
  await connection();
  const userId = await requireCustomerSession();
  const [products, labels] = await Promise.all([
    getWishlistProductsCore(userId),
    getLabels((await params).lang),
  ]);

  return (
    <div className="space-y-6">
      <WishlistMergeOnVisit serverSlugs={products.map((product) => product.slug)} />
      <h2 className="text-lg font-semibold">{label(labels, "shop.account.nav.wishlist")}</h2>

      {products.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <Heart className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {label(labels, "shop.account.wishlist.empty")}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/products">{label(labels, "shop.account.wishlist.discover")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col gap-2">
              <ProductCard product={product} />
              <WishlistRemoveButton slug={product.slug} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
