export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { WishlistMergeOnVisit } from "@/components/storefront/wishlist-merge-on-visit";
import { WishlistRemoveButton } from "@/components/storefront/wishlist-remove-button";
import { getWishlistProductsCore } from "@/server/wishlist";
import { requireCustomerSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Wunschliste",
  description: "Gemerkte Produkte — coder-shop.",
  robots: { index: false },
};

// The account's wishlist (issue #46): the browser list syncs into the account while
// logged in, so it survives logout/login and is available on every device.
export default async function WishlistPage() {
  await connection();
  const userId = await requireCustomerSession();
  const products = await getWishlistProductsCore(userId);

  return (
    <div className="space-y-6">
      <WishlistMergeOnVisit serverSlugs={products.map((product) => product.slug)} />
      <h2 className="text-lg font-semibold">Wunschliste</h2>

      {products.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <Heart className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Noch keine gemerkten Produkte. Über das Herz auf einem Produkt merken Sie es sich
            hier.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/products">Produkte entdecken</Link>
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
