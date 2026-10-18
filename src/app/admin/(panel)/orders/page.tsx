export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatChf, formatDate } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { ORDER_STATUSES } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";
import { getRequestLabels } from "@/server/i18n";
import {
  ORDER_LIST_LIMIT,
  countOrdersByStatus,
  listOrders,
  type OrderFilter,
} from "@/server/orders-admin";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.orders.title"),
    description: label(labels, "admin.meta.orders.description"),
  };
}

const TABS: OrderFilter[] = ["all", ...ORDER_STATUSES];

function activeFilter(raw: string | undefined): OrderFilter {
  return TABS.includes(raw as OrderFilter) ? (raw as OrderFilter) : "all";
}

async function OrdersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [params, labels] = await Promise.all([searchParams, getRequestLabels()]);
  const raw = typeof params.status === "string" ? params.status : undefined;
  const filter = activeFilter(raw);
  const [orders, counts] = await Promise.all([
    listOrders(filter),
    countOrdersByStatus(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.orders.title")}</h1>

      <nav
        className="mt-4 flex flex-wrap gap-1 border-b"
        aria-label={label(labels, "admin.orders.statusFilterAria")}
      >
        {TABS.map((tab) => {
          const count = tab === "all" ? counts.all : counts.byStatus[tab];
          const active = tab === filter;
          const text =
            tab === "all"
              ? label(labels, "admin.action.all")
              : label(labels, `shop.status.${tab}`);
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
              {text}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{label(labels, "admin.orders.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.order")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.date")}</th>
                <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.customer")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.orders.column.items")}</th>
                <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.orders.column.total")}</th>
                <th className="py-2 font-medium">{label(labels, "admin.orders.column.status")}</th>
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
                    <OrderStatusBadge status={order.status} labels={labels} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {orders.length >= ORDER_LIST_LIMIT && (
        <p className="mt-3 text-sm text-muted-foreground">
          {interpolate(label(labels, "admin.orders.cap"), { limit: ORDER_LIST_LIMIT })}
        </p>
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
