export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PasswordForm } from "@/components/admin/password-form";
import { RevenueSparkline } from "@/components/admin/revenue-sparkline";
import { formatChf, formatDate } from "@/lib/format";
import { getDashboardData, REVENUE_WINDOW_DAYS } from "@/server/dashboard";

export const metadata: Metadata = {
  title: "Dashboard — Admin",
  description: "Umsatz, offene Bestellungen und Low-Stock-Alarme.",
};

async function DashboardView() {
  await connection();
  const data = await getDashboardData();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Umsatz der letzten {REVENUE_WINDOW_DAYS} Tage (Status bezahlt bis zugestellt).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Umsatz ({REVENUE_WINDOW_DAYS} Tage)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatChf(data.revenueCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-primary">
            <RevenueSparkline values={data.revenueSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Offene Bestellungen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.openOrders}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/orders"
              className="text-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Zu den Bestellungen
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Lieferungen ausstehend</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.pendingShipments}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/packing"
              className="text-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Zur Kommissionierung
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Abholungen bereit</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.readyForPickup}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/pickup"
              className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Zur Abholung
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section aria-label="Low-Stock-Alarme">
          <h2 className="text-lg font-semibold">Low Stock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Varianten mit Bestand ≤ Meldegrenze.
          </p>
          {data.lowStock.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Keine Alarme — alle Varianten über der Meldegrenze.
            </p>
          ) : (
            <Card className="mt-3">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Produkt</th>
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 text-right font-medium">Bestand</th>
                      <th className="px-4 py-2 text-right font-medium">Grenze</th>
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
                            href={`/produkt/${row.slug}`}
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

        <section aria-label="Letzte Bestellungen">
          <h2 className="text-lg font-semibold">Letzte Bestellungen</h2>
          {data.recentOrders.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Noch keine Bestellungen.
            </p>
          ) : (
            <Card className="mt-3">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Bestellung</th>
                      <th className="px-4 py-2 font-medium">Datum</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="px-4 py-2 font-medium">Status</th>
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
                          <OrderStatusBadge status={order.status} />
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

      <section aria-label="Passwort ändern" className="mt-8">
        <h2 className="text-lg font-semibold">Passwort ändern</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Das Seed-Passwort gilt nur beim ersten Anlegen — hier ändern Sie es jederzeit.
        </p>
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
