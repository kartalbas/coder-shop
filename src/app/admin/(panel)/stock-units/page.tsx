export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { STOCK_UNIT_STATUS_LABELS, type StockUnitStatus } from "@/lib/stock-units";
import { formatDateTime } from "@/lib/format";
import { STOCK_UNIT_LIST_LIMIT, searchStockUnits } from "@/server/stock-units";

interface PagePropsLocal {
  searchParams: Promise<{ q?: string }>;
}

export const metadata: Metadata = {
  title: "Serienlager — Admin",
  description: "Geräte pro Seriennummer: Status, Bestellung und Verlauf.",
};

const STATUS_STYLES: Record<StockUnitStatus, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  reserved: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  packed: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  shipped: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sold: "bg-muted text-muted-foreground",
};

async function StockUnitsView({ searchParams }: PagePropsLocal) {
  await connection();
  const { q } = await searchParams;
  const units = await searchStockUnits(q ?? "");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Serienlager</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Jedes Gerät mit Seriennummer (IMEI) — von der Wareneingangsbuchung bis zum
        Verkauf. Suche über Seriennummer oder SKU.
      </p>

      <form method="get" action="/admin/stock-units" className="mt-4 flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Seriennummer oder SKU…"
          aria-label="Seriennummer oder SKU suchen"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Suchen
        </button>
      </form>

      {units.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Keine Einheiten gefunden — Seriennummern entstehen beim Wareneingang
          seriell geführter Typen.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {units.map((unit) => (
            <article key={unit.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold">{unit.serial}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[unit.status]}`}
                >
                  {STOCK_UNIT_STATUS_LABELS[unit.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                SKU {unit.sku}
                {unit.orderNumber ? ` · Bestellung ${unit.orderNumber}` : ""}
                {unit.purchaseOrderId ? " · aus Wareneingang" : ""}
              </p>
              <ol className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                {unit.history.map((entry, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span>
                      {STOCK_UNIT_STATUS_LABELS[entry.status]}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </span>
                    <span className="tabular-nums">{formatDateTime(entry.at)}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {units.length >= STOCK_UNIT_LIST_LIMIT && (
            <p className="text-sm text-muted-foreground">
              Es werden die neuesten {STOCK_UNIT_LIST_LIMIT} Einheiten angezeigt —
              weiter eingrenzen mit der Suche.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminStockUnitsPage({ searchParams }: PagePropsLocal) {
  return <StockUnitsView searchParams={searchParams} />;
}
