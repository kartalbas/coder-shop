export const instant = false;

import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { RecentlyViewedRail } from "@/components/storefront/recently-viewed";
import { ProductCardSkeleton } from "@/components/storefront/skeletons";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";
import { getCollectionProducts, getFeaturedProducts } from "@/server/search";
import { COLLECTIONS } from "@/lib/collections";
import { VAT_LABEL } from "@/lib/pricing";

const CATEGORIES = [
  { type: "smartphone", description: "Neueste Modelle führender Marken" },
  { type: "shoes", description: "Running, Lifestyle und mehr" },
  { type: "clothing", description: "Funktionsbekleidung für jeden Tag" },
] as const;

async function FeaturedRail() {
  await connection();
  const featured = await getFeaturedProducts(12);
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16" aria-labelledby="beliebt-heading">
      <div className="mb-6 flex items-center justify-between">
        <h2 id="beliebt-heading" className="text-2xl font-semibold tracking-tight">
          Beliebte Produkte
        </h2>
        <Link
          href="/produkte"
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Alle ansehen
        </Link>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
        {featured.map((product) => (
          <div key={product.id} className="w-56 shrink-0 snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}

const COLLECTION_BLURBS: Record<(typeof COLLECTIONS)[number], string> = {
  Neuheiten: "Frisch eingetroffen — die neuesten Zugänge im Sortiment.",
  Bestseller: "Das kaufen unsere Kundinnen und Kunden am häufigsten.",
  Sale: "Reduzierte Angebote, solange der Vorrat reicht.",
};

// Featured collections (issue #23): the seed's `collection` field, rendered as rails
// whose links lead to the filtered listing.
async function Collections() {
  await connection();
  const sections = await Promise.all(
    COLLECTIONS.map(async (collection) => ({
      collection,
      products: await getCollectionProducts(collection, 4),
    })),
  );
  const filled = sections.filter((section) => section.products.length > 0);
  if (filled.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl space-y-12 px-4 py-12" aria-label="Kuratierte Kollektionen">
      {filled.map(({ collection, products }) => (
        <div key={collection}>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">{collection}</h2>
            <Link
              href={`/produkte?collection=${encodeURIComponent(collection)}`}
              className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Alle ansehen
            </Link>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">{COLLECTION_BLURBS[collection]}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function CollectionsSkeleton() {
  return (
    <section className="mx-auto max-w-7xl space-y-12 px-4 py-12" aria-hidden>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i}>
          <div className="mb-6 h-8 w-40 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, j) => (
              <ProductCardSkeleton key={j} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function FeaturedRailSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16" aria-hidden>
      <div className="mb-6 h-8 w-56 rounded bg-muted" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-56 shrink-0">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-muted/60 to-background">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
          <p className="rounded-full border px-3 py-1 text-xs font-medium">Neuheiten jede Woche</p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Technik, Style und Komfort — in der Schweiz zuhause.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Smartphones, Schuhe und Kleidung zu fairen Preisen in CHF, inklusive {VAT_LABEL} und
            schnellem Versand.
          </p>
          <div className="flex gap-3">
            <Button asChild size="lg">
              <Link href="/produkte">
                Jetzt entdecken <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/produkte?collection=Neuheiten">Neuheiten</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="kategorien-heading">
        <h2 id="kategorien-heading" className="mb-6 text-2xl font-semibold tracking-tight">
          Kategorien
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((category) => (
            <Link
              key={category.type}
              href={`/produkte?type=${category.type}`}
              className="group rounded-xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              <p className="text-lg font-semibold group-hover:text-primary">
                {PRODUCT_TYPE_LABELS[category.type]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Ansehen{" "}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={<CollectionsSkeleton />}>
        <Collections />
      </Suspense>

      <Suspense fallback={<FeaturedRailSkeleton />}>
        <FeaturedRail />
      </Suspense>

      {/* Issue #46: "Zuletzt angesehen" from this browser's history (client-side). */}
      <RecentlyViewedRail />
    </>
  );
}
