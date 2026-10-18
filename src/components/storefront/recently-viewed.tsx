"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/storefront/product-card";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";
import { recordViewed, useRecentlyViewed } from "@/stores/recently-viewed";
import type { ProductDto } from "@/server/search";

const RAIL_LIMIT = 8;

// Records the viewed product (issue #46) — rendered on the product page.
export function RecentlyViewedTracker({ slug }: { slug: string }) {
  useEffect(() => {
    recordViewed(slug);
  }, [slug]);
  return null;
}

// "Zuletzt angesehen" rail for the home and product pages (issue #46). The slugs live
// in this browser's localStorage, so the products are fetched from the JSON API once
// the list is known; with no history the rail renders nothing at all.
export function RecentlyViewedRail({ excludeSlug }: { excludeSlug?: string }) {
  const labels = useLabels();
  const viewed = useRecentlyViewed();
  const key = useMemo(
    () =>
      viewed
        .filter((slug) => slug !== excludeSlug)
        .slice(0, RAIL_LIMIT)
        .join(","),
    [viewed, excludeSlug],
  );
  // The fetched products with the slug list they were fetched for; anything for another
  // list is not shown, so a stale answer can never flash and no state reset is needed.
  const [result, setResult] = useState<{ key: string; items: ProductDto[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    fetch(`/api/recently-viewed?slugs=${encodeURIComponent(key)}`)
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((body: { items: ProductDto[] }) => {
        if (active) setResult({ key, items: body.items });
      })
      .catch(() => {
        if (active) setResult({ key, items: [] });
      });
    return () => {
      active = false;
    };
  }, [key]);

  const products = result?.key === key ? result.items : [];
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16" aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="mb-6 text-2xl font-semibold tracking-tight">
        {label(labels, "shop.recent.title")}
      </h2>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {products.map((product) => (
          <div key={product.id} className="w-56 shrink-0 snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
