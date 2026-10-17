"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const TYPE_TABS = [
  { value: "", label: "Alle" },
  { value: "smartphone", label: "Smartphones" },
  { value: "shoes", label: "Schuhe" },
  { value: "clothing", label: "Kleidung" },
] as const;

const FACET_KEYS: FacetKey[] = ["brand", "size", "color", "storage", "material"];

export function ListingShell({ initial }: { initial: ListingResult }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListingResult>(initial);
  const [pending, setPending] = useState(false);
  const initialQuery = useRef(searchParams.toString());
  const skipFirst = useRef(true);

  const type = searchParams.get("type") ?? "";
  const sort = (searchParams.get("sort") as SortKey | null) ?? "newest";
  const selected = Object.fromEntries(
    FACET_KEYS.map((key) => [key, searchParams.get(key)]).filter(([, v]) => v != null),
  ) as Partial<Record<FacetKey, string>>;

  const applyParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in updates)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `/produkte?${qs}` : "/produkte", { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (skipFirst.current && searchParams.toString() === initialQuery.current) {
      skipFirst.current = false;
      return;
    }
    skipFirst.current = false;
    const controller = new AbortController();
    setPending(true);
    fetch(`/api/products?${searchParams.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: ListingResult | null) => {
        if (result) setData(result);
      })
      .catch(() => undefined)
      .finally(() => setPending(false));
    return () => controller.abort();
  }, [searchParams]);

  const toggleFacet = (key: FacetKey, value: string) => {
    applyParams({ [key]: selected[key] === value ? null : value });
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (type) next.set("type", type);
    const qs = next.toString();
    router.replace(qs ? `/produkte?${qs}` : "/produkte", { scroll: false });
  };

  const sidebar = (
    <FilterSidebar facets={data.facets} selected={selected} onToggle={toggleFacet} />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TYPE_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={tab.value === type ? "default" : "outline"}
            size="sm"
            onClick={() => applyParams({ type: tab.value || null })}
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
