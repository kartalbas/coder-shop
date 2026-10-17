"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWishlist, useWishlist, useWishlistHydrated } from "@/stores/wishlist";

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
  const { slugs } = useWishlist();
  const hydrated = useWishlistHydrated();
  const active = slugs.includes(slug);
  return (
    <button
      type="button"
      disabled={!hydrated}
      aria-pressed={active}
      aria-label={active ? `${name} von der Wunschliste entfernen` : `${name} auf die Wunschliste`}
      title={active ? "Von der Wunschliste entfernen" : "Auf die Wunschliste"}
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
