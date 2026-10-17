"use client";

import { useCallback, useEffect, useId, useRef, useState, useActionState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PickerDialog, type PickerItem } from "@/components/admin/picker-dialog";
import { formatChf } from "@/lib/format";
import {
  createPurchaseOrderAction,
  searchSkuAction,
  searchSupplierAction,
  type PurchasingActionState,
} from "@/server/actions/admin/purchasing";

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
  const [supplierName, setSupplierName] = useState(suppliers[0]?.name ?? "");
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [articlePickerOpen, setArticlePickerOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  // The picker rows are display data; the numbers needed to seed a line (sale price,
  // last purchase price) are kept per SKU from the same search result.
  const articleData = useRef(new Map<string, { priceCents: number; lastPurchasePriceCents?: number }>());

  // The picker dialogs fetch through these stable callbacks (issue #42).
  const searchArticles = useCallback(async (query: string): Promise<PickerItem[]> => {
    const hits = await searchSkuAction(query);
    for (const hit of hits) {
      articleData.current.set(hit.sku, {
        priceCents: hit.priceCents,
        ...(hit.lastPurchasePriceCents !== undefined && {
          lastPurchasePriceCents: hit.lastPurchasePriceCents,
        }),
      });
    }
    return hits.map((hit) => ({
      id: hit.sku,
      primary: hit.productName,
      secondary: `${hit.sku} · ${hit.variantLabel}`,
      meta: `Lager ${hit.stock}${
        hit.lastPurchasePriceCents !== undefined
          ? ` · zuletzt ${formatChf(hit.lastPurchasePriceCents)}`
          : ""
      }`,
      imageSrc: hit.imageSrc,
    }));
  }, []);

  const searchSupplierItems = useCallback(async (query: string): Promise<PickerItem[]> => {
    const found = await searchSupplierAction(query);
    return found.map((supplier) => ({
      id: supplier.id,
      primary: supplier.name,
      secondary: `Lieferzeit ${supplier.leadTimeDays} Tage`,
      meta: supplier.openPos > 0 ? `${supplier.openPos} offene Bestellungen` : "keine offenen Bestellungen",
    }));
  }, []);

  function addLine(item: PickerItem): void {
    if (lines.some((line) => line.sku === item.id)) return;
    // The line starts at the last purchase price when there is one, otherwise at the
    // 60 % purchase heuristic (as before).
    const data = articleData.current.get(item.id);
    setLines((current) => [
      ...current,
      {
        sku: item.id,
        productName: item.primary,
        variantLabel: item.secondary?.split(" · ").slice(1).join(" · ") ?? "",
        qty: 10,
        unitPriceCents:
          data?.lastPurchasePriceCents ?? Math.round((data?.priceCents ?? 0) * 0.6),
      },
    ]);
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
          <Label>Lieferant</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-haspopup="dialog"
            onClick={() => setSupplierPickerOpen(true)}
          >
            <span className="truncate">{supplierName || "Lieferant wählen"}</span>
            <span className="text-xs text-muted-foreground">Suchen…</span>
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Artikel</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            aria-haspopup="dialog"
            onClick={() => setArticlePickerOpen(true)}
          >
            <span>Artikel hinzufügen</span>
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <PickerDialog
        open={supplierPickerOpen}
        onOpenChange={setSupplierPickerOpen}
        title="Lieferant wählen"
        placeholder="Lieferantensuche, z. B. Tech"
        search={searchSupplierItems}
        onSelect={(item) => {
          setSupplierId(item.id);
          setSupplierName(item.primary);
        }}
      />
      <PickerDialog
        open={articlePickerOpen}
        onOpenChange={setArticlePickerOpen}
        title="Artikel wählen"
        placeholder="Name, SKU oder Marke, z. B. iPhone"
        search={searchArticles}
        onSelect={addLine}
      />

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Noch keine Positionen — über „Artikel hinzufügen“ wählen.
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
