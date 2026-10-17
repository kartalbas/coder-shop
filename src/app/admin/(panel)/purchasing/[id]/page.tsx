export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { MarkOrderedButton, ReceiveButton } from "@/components/admin/po-status-actions";
import { PurchaseOrderStatusBadge } from "@/components/admin/po-status-badge";
import { formatChf, formatDateTime } from "@/lib/format";
import { getPurchaseOrderById } from "@/server/purchasing";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { id } = await params;
  return { title: `Bestellung ${id}`, description: "Einkaufsbestellung und Wareneingang." };
}

async function PurchaseOrderDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const detail = await getPurchaseOrderById(id);
  if (!detail) notFound();
  const { po, supplier, productNames } = detail;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/purchasing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zum Einkauf
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Bestellung {po.poNumber}</h1>
        <PurchaseOrderStatusBadge status={po.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {supplier ? `Lieferant: ${supplier.name}` : "Lieferant: Unbekannt"}
        {supplier?.email ? ` · ${supplier.email}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {po.status === "draft" && <MarkOrderedButton poId={po._id.toString()} />}
        {po.status === "ordered" && <ReceiveButton poId={po._id.toString()} />}
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5" aria-label="Positionen">
        <h2 className="mb-3 text-sm font-semibold">Positionen</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Artikel</th>
                <th className="py-2 pr-4 text-right font-medium">Menge</th>
                <th className="py-2 pr-4 text-right font-medium">Erhalten</th>
                <th className="py-2 pr-4 text-right font-medium">Stückpreis</th>
                <th className="py-2 text-right font-medium">Total</th>
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
                    {formatChf(line.unitPriceCents)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatChf(line.qty * line.unitPriceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatChf(po.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5 text-sm" aria-label="Zeitpunkte">
        <h2 className="mb-3 text-sm font-semibold">Zeitpunkte</h2>
        <dl className="space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Angelegt</dt>
            <dd>{formatDateTime(po.createdAt)}</dd>
          </div>
          {po.orderedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Bestellt</dt>
              <dd>{formatDateTime(po.orderedAt)}</dd>
            </div>
          )}
          {po.receivedAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Erhalten</dt>
              <dd>{formatDateTime(po.receivedAt)}</dd>
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
