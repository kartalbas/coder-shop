"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ListingResult } from "@/server/search";
import type { SortKey } from "@/lib/validations/listing";
import { ProductCard } from "./product-card";
import { FilterSidebar, type FacetKey } from "./filter-sidebar";
import { SortSelect } from "./sort-select";
import { Pagination } from "./pagination";
import { ProductGridSkeleton } from "./skeletons";
import { EmptyState } from "./empty-state";
import { MENU_CATEGORIES, PRODUCT_TYPE_LABELS } from "@/lib/menu";

const TYPE_TABS: { value: string; label: string }[] = [
  { value: "", label: "Alle" },
  ...MENU_CATEGORIES.map((category) => ({ value: category.type, label: category.label })),
];

const FACET_KEYS: FacetKey[] = ["brand", "size", "color", "storage", "material"];

export function ListingShell({ initial }: { initial: ListingResult }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Issue #25: the router re-render triggered by `router.replace` already carries the new
  // listing data (the server page runs the same query) — the old extra client fetch of
  // /api/products made every change load the data twice. Now: one navigation, one request.
  const [pending, startTransition] = useTransition();
  const data = initial;

  const type = searchParams.get("type") ?? "";
  const collection = searchParams.get("collection");
  const sort = (searchParams.get("sort") as SortKey | null) ?? "newest";
  // Issue #24: facets are multi-value — `brand=Apple,Samsung`.
  const selected = Object.fromEntries(
    FACET_KEYS.map((key) => {
      const raw = searchParams.get(key);
      const values = raw ? raw.split(",").filter(Boolean) : [];
      return [key, values.length > 0 ? values : undefined];
    }).filter(([, values]) => values !== undefined),
  ) as Partial<Record<FacetKey, string[]>>;

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
        router.replace(qs ? `/produkte?${qs}` : "/produkte", { scroll: false });
      });
    },
    [router, searchParams],
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

  const toggleFacet = (key: FacetKey, value: string) => {
    const current = selected[key] ?? [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    applyParams({ [key]: next.length > 0 ? next.join(",") : null });
  };

  // Issue #24: switching the category drops every facet — values like a shoe size are
  // meaningless for smartphones and used to leave the listing at 0 products.
  const switchType = (nextType: string) => {
    applyParams({
      type: nextType || null,
      brand: null,
      size: null,
      color: null,
      storage: null,
      material: null,
    });
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (type) next.set("type", type);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/produkte?${qs}` : "/produkte", { scroll: false });
    });
  };

  const sidebar = (
    <FilterSidebar facets={data.facets} selected={selected} onToggle={toggleFacet} />
  );

  // Issue #26: the listing had no <h1> at all (axe page-has-heading-one).
  const heading =
    collection ??
    (type ? PRODUCT_TYPE_LABELS[type as keyof typeof PRODUCT_TYPE_LABELS] : "Alle Produkte");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>

      {collection && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Kollektion:</span>
          <button
            type="button"
            onClick={() => applyParams({ collection: null })}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            {collection}
            <span aria-hidden>×</span>
            <span className="sr-only">Kollektion {collection} entfernen</span>
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TYPE_TABS.map((tab) => (
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
              {data.total} {data.total === 1 ? "Produkt" : "Produkte"}
            </p>
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="size-4" /> Filter
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filter</SheetTitle>
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
