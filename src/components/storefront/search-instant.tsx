"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/storefront/product-image";
import { useFormatters } from "@/components/storefront/locale-formatters";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchHit {
  slug: string;
  name: string;
  type: string;
  priceCents: number;
  priceFrom: boolean;
  image: string | null;
  variantHint: string;
}

export function SearchInstant() {
  const { chf } = useFormatters();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [fetchedQuery, setFetchedQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 200);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      } else if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const term = debouncedQuery.trim();
  const loading = term.length >= 2 && fetchedQuery !== term;

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { hits: [] }))
      .then((data: { hits: SearchHit[] }) => {
        setHits(data.hits);
        setFetchedQuery(term);
        setActiveIndex(-1);
        setOpen(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [term]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = useCallback(
    (slug: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/products/${slug}`);
    },
    [router],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || hits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[activeIndex >= 0 ? activeIndex : 0];
      if (hit) go(hit.slug);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
          aria-label="Schnellsuche"
          placeholder="Suchen… (⌘K)"
          className="pl-8"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 2) {
              setHits([]);
              setOpen(false);
            }
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && hits.length > 0 && (
        <ul
          id="search-listbox"
          role="listbox"
          aria-label="Suchergebnisse"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
        >
          {hits.map((hit, index) => (
            <li key={hit.slug} role="option" id={`search-option-${index}`} aria-selected={index === activeIndex}>
              <button
                type="button"
                // Keyboard navigation runs through the combobox (aria-activedescendant) —
                // the options must not add their own tab stops (issue #26).
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(hit.slug)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring ${
                  index === activeIndex ? "bg-accent" : ""
                }`}
              >
                {hit.image ? (
                  <ProductImage
                    src={hit.image}
                    alt=""
                    className="size-8 shrink-0 rounded object-contain"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{hit.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{hit.variantHint}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold">
                  {hit.priceFrom && (
                    <span className="font-normal text-muted-foreground">ab </span>
                  )}
                  {chf(hit.priceCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Issue #26: say so when nothing matches instead of silently showing nothing. */}
      {open && !loading && term.length >= 2 && hits.length === 0 && (
        <div
          role="status"
          className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg"
        >
          Keine Treffer für «{term}»
        </div>
      )}
    </div>
  );
}
