export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PasswordForm } from "@/components/admin/password-form";
import { RevenueSparkline } from "@/components/admin/revenue-sparkline";
import { formatChf, formatDate } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { getDashboardData, REVENUE_WINDOW_DAYS } from "@/server/dashboard";
import { getRequestLabels } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.dashboard.title"),
    description: label(labels, "admin.meta.dashboard.description"),
  };
}

async function DashboardView() {
  await connection();
  const [data, labels] = await Promise.all([getDashboardData(), getRequestLabels()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.dashboard.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {interpolate(label(labels, "admin.dashboard.intro"), { days: REVENUE_WINDOW_DAYS })}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>
              {interpolate(label(labels, "admin.dashboard.kpi.revenue"), {
                days: REVENUE_WINDOW_DAYS,
              })}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatChf(data.revenueCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-primary">
            <RevenueSparkline
              values={data.revenueSeries}
              ariaLabel={interpolate(label(labels, "admin.dashboard.sparkline.aria"), {
                count: data.revenueSeries.length,
              })}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{label(labels, "admin.dashboard.kpi.openOrders")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.openOrders}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/orders"
              className="text-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {label(labels, "admin.dashboard.link.orders")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{label(labels, "admin.dashboard.kpi.pendingShipments")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.pendingShipments}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/packing"
              className="text-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {label(labels, "admin.dashboard.link.packing")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{label(labels, "admin.dashboard.kpi.readyForPickup")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.readyForPickup}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/pickup"
              className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {label(labels, "admin.dashboard.link.pickup")}
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section aria-label={label(labels, "admin.dashboard.lowStock.aria")}>
          <h2 className="text-lg font-semibold">{label(labels, "admin.dashboard.lowStock.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {label(labels, "admin.dashboard.lowStock.note")}
          </p>
          {data.lowStock.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {label(labels, "admin.dashboard.lowStock.empty")}
            </p>
          ) : (
            <Card className="mt-3">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-2 font-medium">
                        {label(labels, "admin.dashboard.lowStock.column.product")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {label(labels, "admin.dashboard.lowStock.column.sku")}
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        {label(labels, "admin.dashboard.lowStock.column.stock")}
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        {label(labels, "admin.dashboard.lowStock.column.threshold")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.map((row) => (
                      <tr
                        key={row.sku}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={`/products/${row.slug}`}
                            target="_blank"
                            className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {row.productName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{row.variantLabel}</p>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-destructive">
                          {row.stock}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {row.restockThreshold}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>

        <section aria-label={label(labels, "admin.dashboard.recent.title")}>
          <h2 className="text-lg font-semibold">{label(labels, "admin.dashboard.recent.title")}</h2>
          {data.recentOrders.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {label(labels, "admin.orders.none")}
            </p>
          ) : (
            <Card className="mt-3">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-2 font-medium">{label(labels, "admin.orders.column.order")}</th>
                      <th className="px-4 py-2 font-medium">{label(labels, "admin.orders.column.date")}</th>
                      <th className="px-4 py-2 text-right font-medium">{label(labels, "admin.orders.column.total")}</th>
                      <th className="px-4 py-2 font-medium">{label(labels, "admin.orders.column.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {order.orderNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">{order.customerName}</p>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {formatChf(order.totalCents)}
                        </td>
                        <td className="px-4 py-2">
                          <OrderStatusBadge status={order.status} labels={labels} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <section aria-label={label(labels, "admin.account.change")} className="mt-8">
        <h2 className="text-lg font-semibold">{label(labels, "admin.account.change")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.dashboard.password.hint")}</p>
        <Card className="mt-3">
          <CardContent className="p-5 sm:p-6">
            <PasswordForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <DashboardView />;
}
