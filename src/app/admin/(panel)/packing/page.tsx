export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDate } from "@/lib/format";
import { label } from "@/lib/i18n";
import { listPackingQueue } from "@/server/orders-admin";
import { getRequestLabels } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.packing.title"),
    description: label(labels, "admin.meta.packing.description"),
  };
}

async function PackingView() {
  await connection();
  const [queue, labels] = await Promise.all([listPackingQueue(), getRequestLabels()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.packing.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.packing.intro")}</p>

      {queue.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{label(labels, "admin.packing.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.order")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.date")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.customer")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.orders.column.items")}</th>
                <th className="py-2 font-medium">{label(labels, "admin.orders.column.status")}</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/admin/packing/${order.id}`}
                      className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="py-2.5 pr-4">{order.customerName}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{order.itemCount}</td>
                  <td className="py-2.5">
                    <OrderStatusBadge status={order.status} labels={labels} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function PackingPage() {
  return <PackingView />;
}
