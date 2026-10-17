"use client";

import { useEffect, useRef } from "react";
import { syncWishlistAction } from "@/server/actions/wishlist";
import {
  getWishlistSlugs,
  hydrateWishlist,
  setWishlistSlugs,
  subscribeWishlist,
} from "@/stores/wishlist";

// Mirror of the local wishlist to the logged-in account (issue #46). Rendered in the
// storefront layout only when a customer session exists.
//
// On mount the local list is merged into the account (this is the login sync: guest
// items join the stored ones) and the merged result is adopted back, so the hearts
// everywhere show the account's state. Later local changes are pushed as a replace.
// A response is only applied while nothing changed locally since it was sent, so a
// toggle during a round-trip can never be clobbered.
export function WishlistSync() {
  const localVersion = useRef(0);

  useEffect(() => {
    hydrateWishlist();

    const push = async (mode: "merge" | "replace", slugs: string[], version: number) => {
      const result = await syncWishlistAction(slugs, mode);
      if (result.ok && localVersion.current === version) setWishlistSlugs(result.slugs);
    };

    void push("merge", getWishlistSlugs(), localVersion.current);
    return subscribeWishlist(() => {
      localVersion.current += 1;
      void push("replace", getWishlistSlugs(), localVersion.current);
    });
  }, []);

  return null;
}
