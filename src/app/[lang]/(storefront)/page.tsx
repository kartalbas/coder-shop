export const instant = false;

import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { RecentlyViewedRail } from "@/components/storefront/recently-viewed";
import { ProductCardSkeleton } from "@/components/storefront/skeletons";
import { interpolate, label } from "@/lib/i18n";
import { menuCategories } from "@/lib/menu";
import { vatLabel } from "@/lib/shop-settings";
import { getCatalogTypes } from "@/server/catalog-types";
import { getLabels } from "@/server/i18n";
import { getShopSettings } from "@/server/shop-settings";
import { getCollectionProducts, getFeaturedProducts } from "@/server/search";
import { COLLECTIONS } from "@/lib/collections";

// Issue #58 step 3: the hero is the home page's only static-shell content, so its
// texts stream in through one dynamic slot (transparent same-structure fallback, no
// layout shift — same pattern as the header/footer skeletons). The VAT hole folds
// into the lead sentence's {vat} interpolation.
async function HeroSlot({ lang }: { lang: string }) {
  await connection();
  const [labels, settings] = await Promise.all([getLabels(lang), getShopSettings()]);
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:py-24">
      <p className="rounded-full border px-3 py-1 text-xs font-medium">
        {label(labels, "shop.home.heroBadge")}
      </p>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        {label(labels, "shop.home.heroTitle")}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        {interpolate(label(labels, "shop.home.heroLead"), {
          vat: vatLabel(settings.vatRatePercent),
        })}
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/products">
            {label(labels, "shop.home.heroDiscover")} <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/products?collection=${encodeURIComponent(COLLECTIONS[0])}`}>
            {COLLECTIONS[0]}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:py-24"
      aria-hidden
    >
      <p className="rounded-full border px-3 py-1 text-xs font-medium text-transparent">
        Neuheiten
      </p>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
        Technik, Style und Komfort — in der Schweiz zuhause.
      </h1>
      <p className="max-w-xl text-lg text-transparent">
        Faire Preise in CHF, inklusive MwSt. und schnellem Versand aus der Schweiz.
      </p>
      <div className="flex gap-3">
        <div className="h-11 w-40 rounded-md bg-muted" />
        <div className="h-11 w-32 rounded-md border" />
      </div>
    </div>
  );
}

// Issue #61: the category tiles are the catalog type configuration — a new type
// appears here without a code change.
async function Categories({ lang }: { lang: string }) {
  await connection();
  const [categories, labels] = await Promise.all([
    getCatalogTypes().then(menuCategories),
    getLabels(lang),
  ]);
  if (categories.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="kategorien-heading">
      <h2 id="kategorien-heading" className="mb-6 text-2xl font-semibold tracking-tight">
        {label(labels, "shop.home.categories")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {categories.map((category) => (
          <Link
            key={category.type}
            href={`/products?type=${encodeURIComponent(category.type)}`}
            className="group rounded-xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
          >
            <p className="text-lg font-semibold group-hover:text-primary">{category.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {label(labels, "shop.home.categoryBlurb")}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              {label(labels, "shop.home.categoryView")}{" "}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CategoriesSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12" aria-hidden>
      <div className="mb-6 h-8 w-40 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-40 rounded-xl border bg-card" />
        ))}
      </div>
    </section>
  );
}

async function FeaturedRail({ lang }: { lang: string }) {
  await connection();
  // Issue #58 step B1a: the rail's product names resolve through the table.
  const labels = await getLabels(lang);
  const featured = await getFeaturedProducts(12, labels);
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16" aria-labelledby="beliebt-heading">
      <div className="mb-6 flex items-center justify-between">
        <h2 id="beliebt-heading" className="text-2xl font-semibold tracking-tight">
          {label(labels, "shop.home.featured")}
        </h2>
        <Link
          href="/products"
          className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {label(labels, "shop.home.viewAll")}
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

// Featured collections (issue #23): the seed's `collection` field, rendered as rails
// whose links lead to the filtered listing. The blurb text is a translation row keyed
// by the collection itself (`shop.home.blurb.<collection>`) — a new collection is data.
async function Collections({ lang }: { lang: string }) {
  await connection();
  // Issue #58 step B1a: the rails' product names resolve through the table.
  const labels = await getLabels(lang);
  const sections = await Promise.all(
    COLLECTIONS.map(async (collection) => ({
      collection,
      products: await getCollectionProducts(collection, 4, labels),
    })),
  );
  const filled = sections.filter((section) => section.products.length > 0);
  if (filled.length === 0) return null;
  return (
    <section
      className="mx-auto max-w-7xl space-y-12 px-4 py-12"
      aria-label={label(labels, "shop.home.collectionsAria")}
    >
      {filled.map(({ collection, products }) => (
        <div key={collection}>
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">{collection}</h2>
            <Link
              href={`/products?collection=${encodeURIComponent(collection)}`}
              className="text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {label(labels, "shop.home.viewAll")}
            </Link>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            {label(labels, `shop.home.blurb.${collection}`)}
          </p>
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

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-muted/60 to-background">
        <Suspense fallback={<HeroSkeleton />}>
          <HeroSlot lang={lang} />
        </Suspense>
      </section>

      <Suspense fallback={<CategoriesSkeleton />}>
        <Categories lang={lang} />
      </Suspense>

      <Suspense fallback={<CollectionsSkeleton />}>
        <Collections lang={lang} />
      </Suspense>

      <Suspense fallback={<FeaturedRailSkeleton />}>
        <FeaturedRail lang={lang} />
      </Suspense>

      {/* Issue #46: "Zuletzt angesehen" from this browser's history (client-side). */}
      <RecentlyViewedRail />
    </>
  );
}
