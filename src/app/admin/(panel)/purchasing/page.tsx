export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PoCreateForm } from "@/components/admin/po-create-form";
import { PurchaseOrderStatusBadge } from "@/components/admin/po-status-badge";
import { interpolate, label, splitOnPlaceholder } from "@/lib/i18n";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import { PO_LIST_LIMIT, listPurchaseOrders, listSuppliers } from "@/server/purchasing";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.purchasing.title"),
    description: label(labels, "admin.meta.purchasing.description"),
  };
}

async function PurchasingView() {
  await connection();
  const [pos, suppliers, labels] = await Promise.all([
    listPurchaseOrders(),
    listSuppliers(),
    getRequestLabels(),
  ]);
  const f = await getRequestFormatters();
  const noSuppliers = splitOnPlaceholder(
    label(labels, "admin.purchasing.noSuppliers"),
    "link",
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        {label(labels, "admin.purchasing.title")}
      </h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{label(labels, "admin.purchasing.newTitle")}</CardTitle>
          <CardDescription>{label(labels, "admin.purchasing.newDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {noSuppliers.before}
              <Link
                href="/admin/suppliers"
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label(labels, "admin.purchasing.suppliersLink")}
              </Link>
              {noSuppliers.after}
            </p>
          ) : (
            <PoCreateForm suppliers={suppliers.map((s) => ({ id: s._id.toString(), name: s.name }))} />
          )}
        </CardContent>
      </Card>

      <section className="mt-8" aria-label={label(labels, "admin.purchasing.listAria")}>
        <h2 className="text-lg font-semibold">{label(labels, "admin.purchasing.section")}</h2>
        {pos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {label(labels, "admin.purchasing.empty")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.purchasing.column.po")}</th>
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.purchasing.column.supplier")}</th>
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.date")}</th>
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.purchasing.column.arrival")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.orders.column.items")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.orders.column.total")}</th>
                  <th className="py-2 font-medium">{label(labels, "admin.orders.column.status")}</th>
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
                    <td className="py-2.5 pr-4">
                      {po.supplierName ?? label(labels, "admin.purchasing.unknownSupplier")}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {f.date(po.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {po.status === "ordered" && po.expectedArrivalAt
                        ? f.date(po.expectedArrivalAt)
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{po.lineCount}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {f.chf(po.totalCents)}
                    </td>
                    <td className="py-2.5">
                      <PurchaseOrderStatusBadge status={po.status} labels={labels} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pos.length >= PO_LIST_LIMIT && (
          <p className="mt-3 text-sm text-muted-foreground">
            {interpolate(label(labels, "admin.purchasing.cap"), { limit: PO_LIST_LIMIT })}
          </p>
        )}
      </section>
    </div>
  );
}

export default function AdminPurchasingPage() {
  return <PurchasingView />;
}
