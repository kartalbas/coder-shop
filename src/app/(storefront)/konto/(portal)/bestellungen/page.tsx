export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { ClaimOrderForm } from "@/components/storefront/claim-order-form";
import { ReorderButton } from "@/components/storefront/reorder-button";
import { formatChf, formatDate } from "@/lib/format";
import { listAccountOrders } from "@/server/account";
import { requireCustomerSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Meine Bestellungen",
  description: "Bestellhistorie — coder-shop.",
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AccountOrdersPage({ searchParams }: PageProps) {
  await connection();
  const userId = await requireCustomerSession();
  const { q } = await searchParams;
  const orders = await listAccountOrders(userId, q ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Bestellhistorie</h2>
        <ClaimOrderForm />
      </div>

      <form method="get" action="/konto/bestellungen" className="flex max-w-sm gap-2">
        <label htmlFor="order-search" className="sr-only">
          Bestellungen durchsuchen
        </label>
        <Input
          id="order-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Bestellnummer oder Artikel suchen"
        />
        <Button type="submit" variant="outline">
          Suchen
        </Button>
      </form>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {q ? `Keine Bestellung passt zu „${q}“.` : "Noch keine Bestellungen"}
          </p>
          <p className="text-sm text-muted-foreground">
            {q
              ? "Bitte Suchbegriff anpassen."
              : "Sobald Sie etwas bestellen, erscheint es hier."}
          </p>
          {!q && (
            <Button asChild variant="outline">
              <Link href="/produkte">Jetzt einkaufen</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.orderNumber} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/bestellung/${order.orderNumber}`}
                    className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(new Date(order.createdAt))} · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "Artikel" : "Artikel"}
                    {order.trackingNumber && ` · Sendung ${order.trackingNumber}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <span className="tabular-nums font-medium">
                    {formatChf(order.totalCents)}
                  </span>
                  <ReorderButton orderNumber={order.orderNumber} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
