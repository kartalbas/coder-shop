export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { HandoverForm, MarkReadyForm } from "@/components/admin/pickup-actions";
import { formatChf, formatDateTime } from "@/lib/format";
import { listPickupQueueCore } from "@/server/pickup";

export const metadata: Metadata = {
  title: "Abholung — Admin",
  description: "Bestellungen zur Abholung im Laden bereitstellen und übergeben.",
};

async function PickupView() {
  await connection();
  const queue = await listPickupQueueCore();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Abholung</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Bestellungen mit Abholung im Laden — bereitstellen, Code prüfen und bei der
        Übergabe bar oder per Karte kassieren.
      </p>

      {queue.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine offenen Abholungen. Alles übergeben.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Bestellung</th>
                <th className="py-2 pr-4 font-medium">Kunde</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 text-right font-medium">Total</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Aktion</th>
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
                      {order.readyAt && ` · bereit ${formatDateTime(order.readyAt)}`}
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
                    <OrderStatusBadge status={order.status} />
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
