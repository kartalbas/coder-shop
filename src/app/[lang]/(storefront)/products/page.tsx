export const instant = false;

import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listProducts } from "@/server/search";
import { getCatalogTypes } from "@/server/catalog-types";
import { getLabels } from "@/server/i18n";
import { label } from "@/lib/i18n";
import { allFacetDimensionKeys, localizeCatalogTypes } from "@/lib/catalog-types";
import { menuCategories } from "@/lib/menu";
import { parseListingParams } from "@/lib/validations/listing";
import { ListingShell } from "@/components/storefront/listing-shell";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

// Issue #58 step 3: the metadata texts come from the translation table in the request
// language (behind connection(), like the `[lang]` layout's own metadata).
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/products">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.products.title"),
    description: label(labels, "shop.meta.products.description"),
  };
}

async function ProductsView({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/products">["params"];
  searchParams: PageProps<"/[lang]/products">["searchParams"];
}) {
  await connection();
  // Issue #61: everything the listing knows about types, facets and labels comes from
  // the catalog type configuration.
  const types = await getCatalogTypes();
  const parsed = parseListingParams(await searchParams, types);
  // Issue #58 step B1a: the grid's product names resolve through the table in the
  // request language. Issue #58 step B1b: so do the tab and heading type labels.
  const labels = await getLabels((await params).lang);
  const initial = await listProducts(parsed, labels);
  return (
    <ListingShell
      initial={initial}
      categories={menuCategories(localizeCatalogTypes(types, labels))}
      facetKeys={allFacetDimensionKeys(types)}
    />
  );
}

export default function ProductsPage({ params, searchParams }: PageProps<"/[lang]/products">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><ProductGridSkeleton /></div>}>
      <ProductsView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
