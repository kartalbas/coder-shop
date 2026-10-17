"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncWishlistAction } from "@/server/actions/wishlist";
import { getWishlistSlugs } from "@/stores/wishlist";

// The portal wishlist is server-rendered from the account, but the browser may still
// hold local items that have not merged into it yet (right after registration, before
// the layout sync round-trip finished). Merge them on visit and re-render the list.
export function WishlistMergeOnVisit({ serverSlugs }: { serverSlugs: string[] }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const local = getWishlistSlugs();
    if (local.length === 0 || local.every((slug) => serverSlugs.includes(slug))) return;
    void syncWishlistAction(local, "merge").then((result) => {
      if (result.ok && result.slugs.join("|") !== serverSlugs.join("|")) router.refresh();
    });
  }, [serverSlugs, router]);

  return null;
}
