"use client";

import { useEffect } from "react";
import { hydrateRecentlyViewed } from "@/stores/recently-viewed";
import { hydrateWishlist } from "@/stores/wishlist";

// Reads the localStorage-backed wishlist and recently-viewed lists after mount (issue
// #46) — same hydrate-after-mount rule as the cart, so nothing flashes or mismatches.
export function LocalStoreHydrator() {
  useEffect(() => {
    hydrateWishlist();
    hydrateRecentlyViewed();
  }, []);
  return null;
}
