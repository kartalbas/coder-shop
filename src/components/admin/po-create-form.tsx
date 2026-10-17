"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatChf } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import {
  createPurchaseOrderAction,
  searchSkuAction,
  type PurchasingActionState,
} from "@/server/actions/admin/purchasing";
import type { SkuSearchHit } from "@/server/purchasing";

interface DraftLine {
  sku: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unitPriceCents: number;
}

function parseChfToCents(raw: string): number {
  const value = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : 0;
}

export function PoCreateForm({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState<PurchasingActionState | null, FormData>(
    createPurchaseOrderAction,
    null,
  );
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; hits: SkuSearchHit[] } | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const debouncedQuery = useDebounce(query, 200);
  const queryLongEnough = debouncedQuery.trim().length >= 2;
  const hits = results?.query === debouncedQuery ? results.hits : [];
  const searching = queryLongEnough && results?.query !== debouncedQuery;

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (!queryLongEnough) return;
    let cancelled = false;
    searchSkuAction(debouncedQuery)
      .then((found) => {
        if (!cancelled) setResults({ query: debouncedQuery, hits: found });
      })
      .catch(() => {
        if (cancelled) return;
        setResults({ query: debouncedQuery, hits: [] });
        toast.error("SKU-Suche fehlgeschlagen.");
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, queryLongEnough]);

  function addLine(hit: SkuSearchHit): void {
    if (lines.some((line) => line.sku === hit.sku)) return;
    setLines((current) => [
      ...current,
      {
        sku: hit.sku,
        productName: hit.productName,
        variantLabel: hit.variantLabel,
        qty: 10,
        unitPriceCents: Math.round(hit.priceCents * 0.6),
      },
    ]);
    setQuery("");
  }

  function updateLine(sku: string, patch: Partial<DraftLine>): void {
    setLines((current) =>
      current.map((line) => (line.sku === sku ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(sku: string): void {
    setLines((current) => current.filter((line) => line.sku !== sku));
  }

  const totalCents = lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
  const payload = JSON.stringify({
    supplierId,
    lines: lines.map((line) => ({
      sku: line.sku,
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
    })),
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-supplier`}>Lieferant</Label>
          <Select
            value={supplierId}
            onValueChange={setSupplierId}
            disabled={suppliers.length === 0}
          >
            <SelectTrigger id={`${formId}-supplier`} className="w-full">
              <SelectValue placeholder="Lieferant wählen" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-sku`}>SKU suchen</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={`${formId}-sku`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SKU-Teilbegriff, z. B. APF-"
              className="pl-8"
              autoComplete="off"
            />
          </div>
          {(hits.length > 0 || searching) && (
            <ul
              className="max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground"
              aria-label="SKU-Suchergebnisse"
            >
              {searching && hits.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Suche…</li>
              )}
              {hits.map((hit) => (
                <li key={hit.sku}>
                  <button
                    type="button"
                    onClick={() => addLine(hit)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-xs">{hit.sku}</span>{" "}
                      <span className="block truncate">{hit.productName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Lager {hit.stock}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Noch keine Positionen — SKU oben suchen und hinzufügen.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.sku}
              className="flex flex-wrap items-end gap-3 rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.productName}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{line.sku}</span> · {line.variantLabel}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${formId}-qty-${line.sku}`} className="text-xs">
                  Menge
                </Label>
                <Input
                  id={`${formId}-qty-${line.sku}`}
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(line.sku, { qty: Math.max(1, Number(event.target.value) || 1) })
                  }
                  className="w-20"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${formId}-price-${line.sku}`} className="text-xs">
                  Preis (CHF)
                </Label>
                <Input
                  id={`${formId}-price-${line.sku}`}
                  inputMode="decimal"
                  value={(line.unitPriceCents / 100).toFixed(2)}
                  onChange={(event) =>
                    updateLine(line.sku, { unitPriceCents: parseChfToCents(event.target.value) })
                  }
                  className="w-28"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Position ${line.sku} entfernen`}
                onClick={() => removeLine(line.sku)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm">
          Total: <span className="font-semibold tabular-nums">{formatChf(totalCents)}</span>
        </p>
        <Button type="submit" disabled={pending || lines.length === 0 || !supplierId}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Bestellung anlegen
        </Button>
      </div>
    </form>
  );
}
