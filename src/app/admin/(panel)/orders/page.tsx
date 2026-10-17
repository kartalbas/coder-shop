export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatChf, formatDate } from "@/lib/format";
import { ORDER_STATUSES } from "@/lib/orders/state-machine";
import { STATUS_LABELS } from "@/lib/orders/labels";
import { cn } from "@/lib/utils";
import { countOrdersByStatus, listOrders, type OrderFilter } from "@/server/orders-admin";

export const metadata: Metadata = {
  title: "Bestellungen — Admin",
  description: "Bestellungen mit Statusfilter und Übergängen.",
};

const TABS: { filter: OrderFilter; label: string }[] = [
  { filter: "all", label: "Alle" },
  ...ORDER_STATUSES.map((status) => ({ filter: status as OrderFilter, label: STATUS_LABELS[status] })),
];

function activeFilter(raw: string | undefined): OrderFilter {
  return TABS.some((tab) => tab.filter === raw) ? (raw as OrderFilter) : "all";
}

async function OrdersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const raw = typeof params.status === "string" ? params.status : undefined;
  const filter = activeFilter(raw);
  const [orders, counts] = await Promise.all([
    listOrders(filter),
    countOrdersByStatus(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Bestellungen</h1>

      <nav
        className="mt-4 flex flex-wrap gap-1 border-b"
        aria-label="Statusfilter"
      >
        {TABS.map(({ filter: tab, label }) => {
          const count = tab === "all" ? counts.all : counts.byStatus[tab];
          const active = tab === filter;
          return (
            <Link
              key={tab}
              href={tab === "all" ? "/admin/orders" : `/admin/orders?status=${tab}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Keine Bestellungen in diesem Status.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Bestellung</th>
                <th className="py-2 pr-4 font-medium">Datum</th>
                <th className="py-2 pr-4 font-medium">Kunde</th>
                <th className="py-2 pr-4 text-right font-medium">Positionen</th>
                <th className="py-2 pr-4 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
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
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {formatChf(order.totalCents)}
                  </td>
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

export default function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <OrdersView searchParams={searchParams} />
  );
}
