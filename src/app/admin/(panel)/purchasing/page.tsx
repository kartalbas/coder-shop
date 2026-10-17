export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PoCreateForm } from "@/components/admin/po-create-form";
import { PurchaseOrderStatusBadge } from "@/components/admin/po-status-badge";
import { formatChf, formatDate } from "@/lib/format";
import { listPurchaseOrders, listSuppliers } from "@/server/purchasing";

export const metadata: Metadata = {
  title: "Einkauf — Admin",
  description: "Bestellvorschläge und Wareneingang.",
};

async function PurchasingView() {
  await connection();
  const [pos, suppliers] = await Promise.all([listPurchaseOrders(), listSuppliers()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Einkauf</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Neue Bestellung</CardTitle>
          <CardDescription>
            Positionen per SKU-Suche hinzufügen — der Entwurf kann danach bestellt werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Lieferanten — zuerst unter{" "}
              <Link
                href="/admin/suppliers"
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Lieferanten
              </Link>{" "}
              anlegen.
            </p>
          ) : (
            <PoCreateForm suppliers={suppliers.map((s) => ({ id: s._id.toString(), name: s.name }))} />
          )}
        </CardContent>
      </Card>

      <section className="mt-8" aria-label="Bestellungsliste">
        <h2 className="text-lg font-semibold">Bestellungen</h2>
        {pos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Noch keine Bestellungen.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Bestell-Nr.</th>
                  <th className="py-2 pr-4 font-medium">Lieferant</th>
                  <th className="py-2 pr-4 font-medium">Datum</th>
                  <th className="py-2 pr-4 text-right font-medium">Positionen</th>
                  <th className="py-2 pr-4 text-right font-medium">Total</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/admin/purchasing/${po.id}`}
                        className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{po.supplierName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatDate(po.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{po.lineCount}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {formatChf(po.totalCents)}
                    </td>
                    <td className="py-2.5">
                      <PurchaseOrderStatusBadge status={po.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminPurchasingPage() {
  return <PurchasingView />;
}
