"use client";

import { useEffect } from "react";
import { hydrateCompare } from "@/stores/compare";
import { hydrateRecentlyViewed } from "@/stores/recently-viewed";
import { hydrateWishlist } from "@/stores/wishlist";

// Reads the localStorage-backed wishlist, recently-viewed and comparison lists after
// mount (issue #46/#48) — same hydrate-after-mount rule as the cart, so nothing
// flashes or mismatches.
export function LocalStoreHydrator() {
  useEffect(() => {
    hydrateWishlist();
    hydrateRecentlyViewed();
    hydrateCompare();
  }, []);
  return null;
}
