"use client";

import Link from "next/link";
import { useFormatters } from "@/components/locale-formatters";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { CompareToggle } from "@/components/storefront/compare-toggle";
import { ProductImage } from "@/components/storefront/product-image";
import { StarRating } from "@/components/storefront/star-rating";
import { WishlistHeart } from "@/components/storefront/wishlist-heart";
import type { ProductDto } from "@/server/search";

export function ProductCard({ product }: { product: ProductDto }) {
  const { chf, number } = useFormatters();
  const labels = useLabels();
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={product.name}
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.images[0] ? (
            <ProductImage
              src={product.images[0].src}
              alt={product.images[0].alt}
              className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
          {product.featured && (
            <Badge className="absolute left-2 top-2" variant="secondary">
              {label(labels, "shop.card.featured")}
            </Badge>
          )}
          {totalStock === 0 && (
            <Badge className="absolute bottom-2 left-2" variant="destructive">
              {label(labels, "shop.state.soldOut")}
            </Badge>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.brand}</p>
          <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
          {/* Issue #47: approved-review rating, only once there are reviews. */}
          {product.rating.count > 0 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <StarRating value={product.rating.average} />
              {number(product.rating.average)}
              <span>({product.rating.count})</span>
            </p>
          )}
          <p className="mt-auto pt-1 text-sm font-semibold">
            {product.priceFrom && (
              <span className="font-normal text-muted-foreground">
                {label(labels, "shop.price.from")}{" "}
              </span>
            )}
            {chf(product.minPriceCents)}
          </p>
        </div>
      </Link>
      {/* Issue #46: the heart sits beside the link (a button inside an <a> is invalid). */}
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
        <WishlistHeart slug={product.slug} name={product.name} />
        {/* Issue #48/#61: comparability is a flag on the product's catalog type. */}
        {product.comparable && (
          <CompareToggle slug={product.slug} name={product.name} />
        )}
      </div>
    </div>
  );
}
