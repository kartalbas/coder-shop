export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import {
  ExpectedArrivalForm,
  MarkOrderedButton,
  ReceiveForm,
} from "@/components/admin/po-status-actions";
import { PurchaseOrderStatusBadge } from "@/components/admin/po-status-badge";
import { interpolate, label } from "@/lib/i18n";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import { getPurchaseOrderById } from "@/server/purchasing";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  await connection();
  const [{ id }, labels] = await Promise.all([params, getRequestLabels()]);
  return {
    title: interpolate(label(labels, "admin.meta.poDetail.title"), { id }),
    description: label(labels, "admin.meta.poDetail.description"),
  };
}

async function PurchaseOrderDetail({ params }: PagePropsLocal) {
  await connection();
  const [{ id }, labels] = await Promise.all([params, getRequestLabels()]);
  const f = await getRequestFormatters();
  const detail = await getPurchaseOrderById(id);
  if (!detail) notFound();
  const { po, supplier, productNames, serialSkus } = detail;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/purchasing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {label(labels, "admin.po.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {interpolate(label(labels, "admin.po.title"), { number: po.poNumber })}
        </h1>
        <PurchaseOrderStatusBadge status={po.status} labels={labels} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {supplier
          ? interpolate(label(labels, "admin.po.supplier"), { name: supplier.name })
          : label(labels, "admin.po.supplierUnknown")}
        {supplier?.email ? ` · ${supplier.email}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        {po.status === "draft" && <MarkOrderedButton poId={po._id.toString()} />}
        {po.status === "ordered" && (
          <>
            <ExpectedArrivalForm
              poId={po._id.toString()}
              defaultValue={(po.expectedArrivalAt ?? new Date()).toISOString().slice(0, 10)}
            />
            <ReceiveForm
              poId={po._id.toString()}
              lines={po.lines
                .map((line) => ({
                  sku: line.sku,
                  open: line.qty - line.received,
                  serial: serialSkus.has(line.sku),
                }))
                .filter((line) => line.open > 0)}
            />
          </>
        )}
      </div>

      <section
        className="mt-6 rounded-xl border bg-card p-5"
        aria-label={label(labels, "admin.orders.column.items")}
      >
        <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.orders.column.items")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.po.column.product")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.po.column.qty")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.po.column.received")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.po.column.ordered")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.po.column.unitPrice")}</th>
                <th className="py-2 text-right font-medium">{label(labels, "admin.orders.column.total")}</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.sku} className="border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium">
                      {productNames.get(line.productId.toString()) ?? line.sku}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{line.qty}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{line.received}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {po.status === "ordered" && line.qty - line.received > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {interpolate(label(labels, "admin.po.stillOpen"), {
                          count: line.qty - line.received,
                        })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {f.chf(line.unitPriceCents)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {f.chf(line.qty * line.unitPriceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between font-semibold">
            <dt>{label(labels, "admin.orders.column.total")}</dt>
            <dd className="tabular-nums">{f.chf(po.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section
        className="mt-6 rounded-xl border bg-card p-5 text-sm"
        aria-label={label(labels, "admin.po.times")}
      >
        <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.po.times")}</h2>
        <dl className="space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label(labels, "admin.po.created")}</dt>
            <dd>{f.dateTime(po.createdAt)}</dd>
          </div>
          {po.orderedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label(labels, "admin.po.column.ordered")}</dt>
              <dd>{f.dateTime(po.orderedAt)}</dd>
            </div>
          )}
          {po.status === "ordered" && po.expectedArrivalAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label(labels, "admin.po.expectedArrival")}</dt>
              <dd>{f.date(po.expectedArrivalAt)}</dd>
            </div>
          )}
          {po.receivedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label(labels, "admin.po.column.received")}</dt>
              <dd>{f.dateTime(po.receivedAt)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}

export default function AdminPurchaseOrderDetailPage({ params }: PagePropsLocal) {
  return <PurchaseOrderDetail params={params} />;
}
