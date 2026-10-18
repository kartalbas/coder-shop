export const instant = false;

import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listProducts } from "@/server/search";
import { getCatalogTypes } from "@/server/catalog-types";
import { allFacetDimensionKeys } from "@/lib/catalog-types";
import { menuCategories } from "@/lib/menu";
import { parseListingParams } from "@/lib/validations/listing";
import { ListingShell } from "@/components/storefront/listing-shell";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export const metadata: Metadata = {
  title: "Alle Produkte",
  description: "Das Sortiment des coder-shop — filterbar nach Marke und den Attributen der Produkte.",
};

async function ProductsView({ searchParams }: { searchParams: PageProps<"/[lang]/products">["searchParams"] }) {
  await connection();
  // Issue #61: everything the listing knows about types, facets and labels comes from
  // the catalog type configuration.
  const types = await getCatalogTypes();
  const parsed = parseListingParams(await searchParams, types);
  const initial = await listProducts(parsed);
  return (
    <ListingShell
      initial={initial}
      categories={menuCategories(types)}
      facetKeys={allFacetDimensionKeys(types)}
    />
  );
}

export default function ProductsPage({ searchParams }: PageProps<"/[lang]/products">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><ProductGridSkeleton /></div>}>
      <ProductsView searchParams={searchParams} />
    </Suspense>
  );
}
