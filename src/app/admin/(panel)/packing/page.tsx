export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDate } from "@/lib/format";
import { listPackingQueue } from "@/server/orders-admin";

export const metadata: Metadata = {
  title: "Kommissionierung — Admin",
  description: "Offene Picklisten und Pakete.",
};

async function PackingView() {
  await connection();
  const queue = await listPackingQueue();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Kommissionierung</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Bestellungen in Kommission oder verpackt — bereit für Pickliste und Etikett.
      </p>

      {queue.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine offenen Sendungen. Alles versandt.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Bestellung</th>
                <th className="py-2 pr-4 font-medium">Datum</th>
                <th className="py-2 pr-4 font-medium">Kunde</th>
                <th className="py-2 pr-4 text-right font-medium">Positionen</th>
                <th className="py-2 font-medium">Status</th>
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
                    <OrderStatusBadge status={order.status} />
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
