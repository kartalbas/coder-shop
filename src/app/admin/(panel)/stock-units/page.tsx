export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { StockUnitStatus } from "@/lib/stock-units";
import { formatDateTime } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { STOCK_UNIT_LIST_LIMIT, searchStockUnits } from "@/server/stock-units";

interface PagePropsLocal {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.stockUnits.title"),
    description: label(labels, "admin.meta.stockUnits.description"),
  };
}

const STATUS_STYLES: Record<StockUnitStatus, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  reserved: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  packed: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  shipped: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  sold: "bg-muted text-muted-foreground",
};

async function StockUnitsView({ searchParams }: PagePropsLocal) {
  await connection();
  const [{ q }, labels] = await Promise.all([searchParams, getRequestLabels()]);
  const units = await searchStockUnits(q ?? "");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.stockUnits.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.stockUnits.intro")}</p>

      <form method="get" action="/admin/stock-units" className="mt-4 flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={label(labels, "admin.stockUnits.searchPlaceholder")}
          aria-label={label(labels, "admin.stockUnits.searchAria")}
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {label(labels, "shop.action.search")}
        </button>
      </form>

      {units.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{label(labels, "admin.stockUnits.empty")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {units.map((unit) => (
            <article key={unit.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold">{unit.serial}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[unit.status]}`}
                >
                  {label(labels, `admin.stockUnits.status.${unit.status}`)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {interpolate(label(labels, "admin.stockUnits.sku"), { sku: unit.sku })}
                {unit.orderNumber ? (
                  <>
                    {" · "}
                    {interpolate(label(labels, "admin.po.title"), { number: unit.orderNumber })}
                  </>
                ) : (
                  ""
                )}
                {unit.purchaseOrderId && unit.purchaseOrderNumber ? (
                  <>
                    {" · "}
                    <Link
                      href={`/admin/purchasing/${unit.purchaseOrderId}`}
                      className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {unit.purchaseOrderNumber}
                    </Link>
                  </>
                ) : (
                  ""
                )}
              </p>
              <ol className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
                {unit.history.map((entry, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span>
                      {label(labels, `admin.stockUnits.status.${entry.status}`)}
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
              {interpolate(label(labels, "admin.stockUnits.cap"), { limit: STOCK_UNIT_LIST_LIMIT })}
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
