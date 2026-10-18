export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { HandoverForm, MarkReadyForm } from "@/components/admin/pickup-actions";
import { formatChf, formatDateTime } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { listPickupQueueCore } from "@/server/pickup";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.pickup.title"),
    description: label(labels, "admin.meta.pickup.description"),
  };
}

async function PickupView() {
  await connection();
  const [queue, labels] = await Promise.all([listPickupQueueCore(), getRequestLabels()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.pickup.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.pickup.intro")}</p>

      {queue.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{label(labels, "admin.pickup.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.order")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.customer")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.pickup.column.code")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.orders.column.total")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.status")}</th>
                <th className="py-2 font-medium">{label(labels, "admin.pickup.column.action")}</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((order) => (
                <tr key={order.id} className="border-b align-middle last:border-0">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                      {order.readyAt &&
                        ` · ${interpolate(label(labels, "admin.pickup.readyAt"), {
                          datetime: formatDateTime(order.readyAt),
                        })}`}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4">{order.customerName}</td>
                  <td className="py-2.5 pr-4 font-mono font-semibold tracking-wider">
                    {order.code}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {formatChf(order.totalCents)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <OrderStatusBadge status={order.status} labels={labels} />
                  </td>
                  <td className="py-2.5">
                    {order.status === "ready" ? (
                      <HandoverForm orderId={order.id} />
                    ) : (
                      <MarkReadyForm orderId={order.id} />
                    )}
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

export default function PickupPage() {
  return <PickupView />;
}
