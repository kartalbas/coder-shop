export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductSearch } from "@/components/admin/product-search";
import { formatChf } from "@/lib/format";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";
import type { ProductType } from "@/models/product";
import { adminProductsQuerySchema, productTypes } from "@/lib/validations/listing";
import { cn } from "@/lib/utils";
import { listProductsAdmin } from "@/server/products-admin";

export const metadata: Metadata = {
  title: "Produkte — Admin",
  description: "Produkte durchsuchen und bearbeiten.",
};

const TYPE_FILTERS: { value: ProductType | undefined; label: string }[] = [
  { value: undefined, label: "Alle" },
  ...productTypes.map((type) => ({ value: type as ProductType, label: PRODUCT_TYPE_LABELS[type] })),
];

async function ProductsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const { q, type, page = 1 } = adminProductsQuerySchema.parse(params);

  const result = await listProductsAdmin({ q, type, page });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const linkFor = (targetPage: number, nextType?: ProductType) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (nextType) search.set("type", nextType);
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query ? `/admin/products?${query}` : "/admin/products";
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Produkte</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Suspense fallback={<div className="h-9 w-full max-w-sm" />}>
          <ProductSearch />
        </Suspense>
        <nav className="flex gap-1" aria-label="Typfilter">
          {TYPE_FILTERS.map(({ value, label }) => (
            <Link
              key={label}
              href={linkFor(1, value)}
              aria-current={value === type ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                value === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {result.total} Produkt{result.total === 1 ? "" : "e"}
        {q ? ` für „${q}“` : ""}
      </p>

      {result.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine Produkte gefunden.{" "}
          <Link href="/admin/products" className="underline underline-offset-2">
            Filter zurücksetzen
          </Link>
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Produkt</th>
                <th className="py-2 pr-4 font-medium">Marke</th>
                <th className="py-2 pr-4 font-medium">Typ</th>
                <th className="py-2 pr-4 text-right font-medium">Basispreis</th>
                <th className="py-2 pr-4 text-right font-medium">Varianten</th>
                <th className="py-2 pr-4 text-right font-medium">Lager</th>
                <th className="py-2 font-medium">Aktion</th>
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
                        Featured
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{item.brand}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{PRODUCT_TYPE_LABELS[item.type]}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {formatChf(item.priceCents)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{item.variantCount}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{item.totalStock}</td>
                  <td className="py-2.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/admin/products/${item.id}`}
                        aria-label={`Produkt ${item.name} bearbeiten`}
                      >
                        Bearbeiten
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
        <nav className="mt-4 flex items-center gap-2 text-sm" aria-label="Seiten">
          <Button size="sm" variant="outline" asChild disabled={result.page <= 1}>
            <Link href={linkFor(Math.max(1, result.page - 1), type)}>Zurück</Link>
          </Button>
          <span className="tabular-nums text-muted-foreground">
            Seite {result.page} von {pages}
          </span>
          <Button size="sm" variant="outline" asChild disabled={result.page >= pages}>
            <Link href={linkFor(Math.min(pages, result.page + 1), type)}>Weiter</Link>
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
