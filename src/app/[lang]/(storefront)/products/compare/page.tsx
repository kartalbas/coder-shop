export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/storefront/product-image";
import { buildComparisonRows, comparableProducts, COMPARE_MAX_PRODUCTS } from "@/lib/compare";
import { dimensionsForTypes, localizeCatalogTypes } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";
import { getCatalogTypes } from "@/server/catalog-types";
import { getProductsBySlugs } from "@/server/search";
import { getIntlLocale, getLabels } from "@/server/i18n";
import { interpolate, label } from "@/lib/i18n";

// Issue #58 step 3 / storefront finish: metadata and body texts from the translation
// table (the #63 rename had mechanically turned the German heading into
// "{type} compare" — the table fixes it).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.compare.title"),
    description: label(labels, "shop.meta.compare.description"),
  };
}

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
  const labels = await getLabels(lang);
  const query = await searchParams;
  const raw = typeof query.slugs === "string" ? query.slugs : undefined;
  if (!raw) notFound();
  // Issue #58 step B1b: the comparable type's name and the attribute row captions are
  // table rows; the row values resolve through the same label map in the lib.
  const types = localizeCatalogTypes(await getCatalogTypes(), labels);
  const comparableTypes = types.filter((type) => type.comparable);
  const comparableKeys = new Set(comparableTypes.map((type) => type.key));
  // Issue #58 step B1a: the compared products' names resolve through the table.
  const products = comparableProducts(
    await getProductsBySlugs(parseSlugs(raw), labels),
    comparableKeys,
  );

  // The copy names the comparable type (catalog data); with none configured there is
  // nothing to compare at all — its own hint, no German fallback in code.
  const comparableType = comparableTypes[0];

  if (!comparableType) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {label(labels, "shop.meta.compare.title")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{label(labels, "shop.compare.none")}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/products">{label(labels, "shop.home.heroDiscover")}</Link>
        </Button>
      </div>
    );
  }

  const typeVars = { type: comparableType.label };
  const comparableHref = `/products?type=${encodeURIComponent(comparableType.key)}`;

  if (products.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {interpolate(label(labels, "shop.compare.heading"), typeVars)}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {interpolate(label(labels, "shop.compare.needTwo"), typeVars)}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={comparableHref}>
            {interpolate(label(labels, "shop.compare.discover"), typeVars)}
          </Link>
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
    // Issue #58 step 2b: prices and weights follow the request language's Intl locale;
    // step 3: the row labels and stock values come from the same language's rows.
    await getIntlLocale(lang),
    labels,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">
        {interpolate(label(labels, "shop.compare.heading"), typeVars)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {interpolate(label(labels, "shop.compare.countLine"), {
          ...typeVars,
          count: products.length,
          max: COMPARE_MAX_PRODUCTS,
        })}
      </p>

      <div className="mt-6 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            {interpolate(label(labels, "shop.compare.caption"), {
              names: products.map((product) => product.name).join(", "),
            })}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-background p-3 text-left">
                <span className="sr-only">{label(labels, "shop.compare.feature")}</span>
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
                  {row.differs && (
                    <span className="sr-only"> {label(labels, "shop.compare.difference")}</span>
                  )}
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
          {interpolate(label(labels, "shop.compare.back"), typeVars)}
        </Link>
      </Button>
    </div>
  );
}
