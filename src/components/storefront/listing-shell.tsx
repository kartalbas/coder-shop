"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ListingResult } from "@/server/search";
import type { SortKey } from "@/lib/validations/listing";
import type { MenuCategory } from "@/lib/menu";
import { ProductCard } from "./product-card";
import { FilterSidebar } from "./filter-sidebar";
import { SortSelect } from "./sort-select";
import { Pagination } from "./pagination";
import { ProductGridSkeleton } from "./skeletons";
import { EmptyState } from "./empty-state";
import { useLabels } from "@/components/labels";
import { useIntlLocale } from "./locale-formatters";
import { interpolate, label, plural } from "@/lib/i18n";

interface Props {
  initial: ListingResult;
  // Issue #61: tabs, facet params and headings all come from the catalog type
  // configuration — the shell itself knows no product types or attributes.
  categories: MenuCategory[];
  // Every facet dimension key over all types — switching the category drops them all.
  facetKeys: string[];
}

export function ListingShell({ initial, categories, facetKeys }: Props) {
  const labels = useLabels();
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Issue #58: the listing URL carries the language prefix — state changes stay on the
  // current localized path instead of bouncing through the proxy's redirect.
  const pathname = usePathname();
  // Issue #25: the router re-render triggered by `router.replace` already carries the new
  // listing data (the server page runs the same query) — the old extra client fetch of
  // /api/products made every change load the data twice. Now: one navigation, one request.
  const [pending, startTransition] = useTransition();
  const data = initial;

  const type = searchParams.get("type") ?? "";
  const collection = searchParams.get("collection");
  const sort = (searchParams.get("sort") as SortKey | null) ?? "newest";
  // Issue #24: facets are multi-value — `brand=Apple,Samsung`.
  const selected: Record<string, string[]> = Object.fromEntries(
    ["brand", ...facetKeys]
      .map((key) => {
        const raw = searchParams.get(key);
        const values = raw ? raw.split(",").filter(Boolean) : [];
        return [key, values] as const;
      })
      .filter(([, values]) => values.length > 0),
  );

  const applyParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in updates)) next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, searchParams, pathname],
  );

  // Issue #25: a new page shows the top of the grid, not the middle of the old one.
  const page = searchParams.get("page") ?? "1";
  const firstPageRender = useRef(true);
  useEffect(() => {
    if (firstPageRender.current) {
      firstPageRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const toggleFacet = (key: string, value: string) => {
    const current = selected[key] ?? [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    applyParams({ [key]: next.length > 0 ? next.join(",") : null });
  };

  // Issue #24: switching the category drops every facet — values like a shoe size are
  // meaningless for smartphones and used to leave the listing at 0 products.
  const switchType = (nextType: string) => {
    applyParams(
      Object.fromEntries([
        ["type", nextType || null],
        ["brand", null],
        ...facetKeys.map((key) => [key, null] as const),
      ]),
    );
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (type) next.set("type", type);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const sidebar = (
    <FilterSidebar
      facets={data.facets}
      dimensions={data.dimensions}
      selected={selected}
      onToggle={toggleFacet}
    />
  );

  // Issue #26: the listing had no <h1> at all (axe page-has-heading-one).
  const heading =
    collection ??
    (categories.find((category) => category.type === type)?.label ??
      label(labels, "shop.listing.allProducts"));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>

      {collection && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{label(labels, "shop.listing.collection")}</span>
          <button
            type="button"
            onClick={() => applyParams({ collection: null })}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            {collection}
            <span aria-hidden>×</span>
            <span className="sr-only">
              {interpolate(label(labels, "shop.listing.removeCollection"), { name: collection })}
            </span>
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[{ value: "", label: label(labels, "shop.listing.all") }, ...categories.map((category) => ({ value: category.type, label: category.label }))].map((tab) => (
          <Button
            key={tab.value}
            variant={tab.value === type ? "default" : "outline"}
            size="sm"
            onClick={() => switchType(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {interpolate(plural(labels, data.total, "shop.listing.count", intlLocale), {
                count: data.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="size-4" /> {label(labels, "shop.listing.filter")}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>{label(labels, "shop.listing.filter")}</SheetTitle>
                  </SheetHeader>
                  <div className="px-4">{sidebar}</div>
                </SheetContent>
              </Sheet>
              <SortSelect value={sort} onChange={(next) => applyParams({ sort: next })} />
            </div>
          </div>

          {pending ? (
            <ProductGridSkeleton count={Math.min(data.pageSize, 12)} />
          ) : data.items.length === 0 ? (
            <EmptyState onReset={resetFilters} />
          ) : (
            <motion.div
              key={`${searchParams.toString()}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            >
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </motion.div>
          )}

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={(page) => applyParams({ page: String(page) })}
          />
        </div>
      </div>
    </div>
  );
}
