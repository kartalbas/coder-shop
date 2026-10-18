export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductSearch } from "@/components/admin/product-search";
import { formatChf } from "@/lib/format";
import { interpolate, label, plural } from "@/lib/i18n";
import { adminProductsQuerySchema } from "@/lib/validations/listing";
import { cn } from "@/lib/utils";
import { getCatalogTypes } from "@/server/catalog-types";
import { getIntlLocale, getRequestLabels, getRequestLanguage } from "@/server/i18n";
import { listProductsAdmin } from "@/server/products-admin";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.products.title"),
    description: label(labels, "admin.meta.products.description"),
  };
}

async function ProductsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [params, labels, intlLocale] = await Promise.all([
    searchParams,
    getRequestLabels(),
    getIntlLocale(await getRequestLanguage()),
  ]);
  const { q, type, page = 1 } = adminProductsQuerySchema.parse(params);

  // Issue #61: the type filter and the type column follow the catalog configuration.
  const types = await getCatalogTypes();
  const typeFilters: { value: string | undefined; label: string }[] = [
    { value: undefined, label: label(labels, "admin.action.all") },
    ...types.map((typeConfig) => ({ value: typeConfig.key, label: typeConfig.label })),
  ];
  const labelOfType = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  const result = await listProductsAdmin({ q, type, page });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const linkFor = (targetPage: number, nextType?: string) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (nextType) search.set("type", nextType);
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query ? `/admin/products?${query}` : "/admin/products";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.products.title")}</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Suspense fallback={<div className="h-9 w-full max-w-sm" />}>
          <ProductSearch />
        </Suspense>
        <nav className="flex gap-1" aria-label={label(labels, "admin.products.typeFilterAria")}>
          {typeFilters.map(({ value, label: filterLabel }) => (
            <Link
              key={filterLabel}
              href={linkFor(1, value)}
              aria-current={value === type ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                value === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {filterLabel}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {interpolate(plural(labels, result.total, "admin.products.count", intlLocale), {
          count: result.total,
        })}
        {q
          ? interpolate(label(labels, "admin.products.count.forQuery"), { query: q })
          : null}
      </p>

      {result.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {label(labels, "admin.products.empty")}{" "}
          <Link href="/admin/products" className="underline underline-offset-2">
            {label(labels, "admin.products.resetFilters")}
          </Link>
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.products.column.product")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.products.column.brand")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.products.column.type")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.products.column.price")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.products.column.variants")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.products.column.stock")}</th>
                <th className="py-2 font-medium">{label(labels, "admin.products.column.action")}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/admin/products/${item.id}`}
                      className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {item.name}
                    </Link>
                    {item.featured && (
                      <Badge variant="outline" className="ml-2 border-primary/40 text-primary">
                        {label(labels, "admin.products.featured")}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{item.brand}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{labelOfType(item.type)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {formatChf(item.priceCents)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{item.variantCount}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{item.totalStock}</td>
                  <td className="py-2.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/admin/products/${item.id}`}
                        aria-label={interpolate(label(labels, "admin.products.editAria"), {
                          name: item.name,
                        })}
                      >
                        {label(labels, "admin.action.edit")}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-2 text-sm" aria-label={label(labels, "admin.pagination.aria")}>
          <Button size="sm" variant="outline" asChild disabled={result.page <= 1}>
            <Link href={linkFor(Math.max(1, result.page - 1), type)}>
              {label(labels, "admin.pagination.previous")}
            </Link>
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {interpolate(label(labels, "admin.pagination.page"), {
              page: result.page,
              pages,
            })}
          </span>
          <Button size="sm" variant="outline" asChild disabled={result.page >= pages}>
            <Link href={linkFor(Math.min(pages, result.page + 1), type)}>
              {label(labels, "admin.pagination.next")}
            </Link>
          </Button>
        </nav>
      )}
    </div>
  );
}

export default function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductsView searchParams={searchParams} />;
}
