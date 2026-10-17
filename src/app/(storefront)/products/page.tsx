export const instant = false;

import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listProducts } from "@/server/search";
import { listingParamsSchema } from "@/lib/validations/listing";
import { ListingShell } from "@/components/storefront/listing-shell";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export const metadata: Metadata = {
  title: "Alle Produkte",
  description: "Smartphones, Schuhe und Kleidung — filterbar nach Marke, Grösse, Farbe und mehr.",
};

async function ProductsView({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  await connection();
  const parsed = listingParamsSchema.safeParse(await searchParams);
  const initial = await listProducts(parsed.success ? parsed.data : {});
  return <ListingShell initial={initial} />;
}

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><ProductGridSkeleton /></div>}>
      <ProductsView searchParams={searchParams} />
    </Suspense>
  );
}
