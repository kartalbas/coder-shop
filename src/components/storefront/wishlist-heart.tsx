"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpolate, label } from "@/lib/i18n";
import { toggleWishlist, useWishlist, useWishlistHydrated } from "@/stores/wishlist";
import { useLabels } from "./labels";

// Heart on product cards and the product page (issue #46). The store is local; the
// WishlistSync component mirrors it to the account while logged in.
export function WishlistHeart({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const labels = useLabels();
  const { slugs } = useWishlist();
  const hydrated = useWishlistHydrated();
  const active = slugs.includes(slug);
  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-pressed={active}
      aria-label={interpolate(
        label(labels, active ? "shop.wishlist.remove" : "shop.wishlist.add"),
        { name },
      )}
      title={label(labels, active ? "shop.wishlist.removeShort" : "shop.wishlist.addShort")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(slug);
      }}
      className={cn(
        "rounded-full border bg-background/90 p-2 shadow-sm backdrop-blur transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring",
        active ? "border-rose-300 text-rose-600 dark:text-rose-400" : "text-muted-foreground",
        className,
      )}
    >
      <Heart className={cn("size-4", active && "fill-current")} aria-hidden />
    </button>
  );
}
