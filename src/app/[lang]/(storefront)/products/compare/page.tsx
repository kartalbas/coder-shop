export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/storefront/product-image";
import { buildComparisonRows, comparableProducts, COMPARE_MAX_PRODUCTS } from "@/lib/compare";
import { dimensionsForTypes } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";
import { getCatalogTypes } from "@/server/catalog-types";
import { getProductsBySlugs } from "@/server/search";
import { getIntlLocale } from "@/server/i18n";

export const metadata: Metadata = {
  title: "Produkte compare",
  description: "Bis zu vier Produkte Seite an Seite — Preise, Marken und die Attribute des Typs.",
};

const MAX_SLUGS = 12;

function parseSlugs(raw: string | undefined): string[] {
  return [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0 && slug.length <= 120),
    ),
  ].slice(0, MAX_SLUGS);
}

// Side-by-side comparison (issue #48): the slugs come from the URL, so a selection is
// shareable; rows where the products differ are highlighted. Issue #61: which types are
// comparable and which attribute rows appear come from the catalog configuration.
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { lang } = await params;
  const query = await searchParams;
  const raw = typeof query.slugs === "string" ? query.slugs : undefined;
  if (!raw) notFound();
  const types = await getCatalogTypes();
  const comparableTypes = types.filter((type) => type.comparable);
  const comparableKeys = new Set(comparableTypes.map((type) => type.key));
  const products = comparableProducts(await getProductsBySlugs(parseSlugs(raw)), comparableKeys);

  // The copy names the comparable type; with none configured there is nothing to
  // compare at all, which is the same hint.
  const comparableLabel = comparableTypes[0]?.label ?? "Produkte";
  const comparableHref = comparableTypes[0]
    ? `/products?type=${encodeURIComponent(comparableTypes[0].key)}`
    : "/products";

  if (products.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{comparableLabel} compare</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Für einen Vergleich braucht es mindestens zwei {comparableLabel}. Über das
          Vergleichs-Symbol auf einem Produkt legen Sie die Liste an.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={comparableHref}>{comparableLabel} entdecken</Link>
        </Button>
      </div>
    );
  }

  const rows = buildComparisonRows(
    products,
    dimensionsForTypes(
      types,
      [...new Set(products.map((product) => product.type))],
    ),
    // Issue #58 step 2b: prices and weights follow the request language's Intl locale.
    await getIntlLocale(lang),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{comparableLabel} compare</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {products.length} von maximal {COMPARE_MAX_PRODUCTS} {comparableLabel} — Zeilen mit
        Unterschieden sind hervorgehoben.
      </p>

      <div className="mt-6 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            Vergleich von {products.map((product) => product.name).join(", ")}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-background p-3 text-left">
                <span className="sr-only">Merkmal</span>
              </th>
              {products.map((product) => (
                <th key={product.id} scope="col" className="min-w-44 p-3 align-bottom">
                  <Link
                    href={`/products/${product.slug}`}
                    className="block focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="mx-auto block h-28 w-28 overflow-hidden rounded-md bg-muted">
                      {product.images[0] ? (
                        <ProductImage
                          src={product.images[0].src}
                          alt={product.images[0].alt}
                          className="size-full object-contain"
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 block text-sm font-semibold">{product.name}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={cn("border-t", row.differs && "bg-amber-50 dark:bg-amber-950/30")}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 bg-background p-3 text-left font-medium",
                    row.differs && "bg-amber-50 dark:bg-amber-950/30",
                  )}
                >
                  {row.label}
                  {row.differs && <span className="sr-only"> (Unterschied)</span>}
                </th>
                {row.values.map((value, index) => (
                  <td key={products[index]!.id} className="p-3 align-top">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button asChild variant="outline" className="mt-6">
        <Link href={comparableHref}>
          <ArrowLeft className="mr-2 size-4" aria-hidden />
          Zurück zu den {comparableLabel}
        </Link>
      </Button>
    </div>
  );
}
