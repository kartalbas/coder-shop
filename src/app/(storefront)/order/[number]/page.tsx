export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PackageCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { OrderStatusChain } from "@/components/storefront/order-status-chain";
import { formatChf, formatDate, formatDateTime, formatWeight } from "@/lib/format";
import { mayViewOrderDetails } from "@/server/order-access";
import { getOrderByNumber, type OrderDto } from "@/server/orders";
import { OrderAccessForm } from "@/components/storefront/order-access-form";
import { VAT_INCLUSIVE_NOTE } from "@/lib/pricing";

const SHIPPING_LABELS: Record<OrderDto["shipping"]["method"], string> = {
  standard: "Standardversand",
  express: "Expressversand",
};

interface PagePropsLocal {
  params: Promise<{ number: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Bestellung ${number}`,
    description: `Status und Details Ihrer Bestellung ${number} — coder-shop.`,
  };
}

async function OrderView({ params }: PagePropsLocal) {
  await connection();
  const { number } = await params;
  const order = await getOrderByNumber(number);
  if (!order) notFound();

  // PII (address, e-mail, phone, items, tracking) is only for the buyer — the browser that
  // completed checkout (access cookie), one that verified the order's e-mail, the owning
  // customer account (issue #39), or an admin. Unauthorized visitors never receive the
  // details in the HTML at all.
  const authorized = await mayViewOrderDetails(order.orderNumber);

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">Vielen Dank für Ihre Bestellung!</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Bestellung {order.orderNumber}
        </h1>
      </div>
      <OrderStatusBadge status={order.status} />
    </div>
  );

  if (!authorized) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        {header}
        <OrderAccessForm orderNumber={order.orderNumber} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {header}

      <Card>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <OrderStatusChain status={order.status} statusLog={order.statusLog} />

          {order.shipping.trackingNumber && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
              <PackageCheck className="size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  Sendungsverfolgung: {order.shipping.trackingNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {SHIPPING_LABELS[order.shipping.method]}
                  {order.shipping.parcelWeightGrams !== undefined &&
                    ` · Paketgewicht ${formatWeight(order.shipping.parcelWeightGrams)}`}
                </p>
              </div>
            </div>
          )}

          {order.payment.method === "invoice" && order.payment.invoice && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium">Zahlung per Rechnung</p>
                <p className="text-xs text-muted-foreground">
                  Zahlbar bis {formatDate(new Date(order.payment.invoice.dueAt))} · Referenz{" "}
                  <span className="font-mono">{order.payment.invoice.qrReference}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.payment.invoice.openCents > 0
                    ? `Offen: ${formatChf(order.payment.invoice.openCents)}`
                    : "Rechnung bezahlt — vielen Dank."}
                </p>
              </div>
              <Link
                href={`/bestellung/${order.orderNumber}/rechnung`}
                className="text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Rechnung als PDF
              </Link>
            </div>
          )}

          <Separator />

          <ul className="space-y-3">
            {order.lines.map((line) => (
              <li key={line.sku} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{line.qty}×</span> {line.name}{" "}
                  <span className="text-muted-foreground">({line.variantLabel})</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatChf(line.totalCents)}</span>
              </li>
            ))}
          </ul>

          <Separator />

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Zwischensumme</dt>
              <dd className="tabular-nums">{formatChf(order.totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {SHIPPING_LABELS[order.shipping.method]}
              </dt>
              <dd className="tabular-nums">
                {order.totals.shippingCents === 0
                  ? "Gratis"
                  : formatChf(order.totals.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Gesamt</dt>
              <dd className="tabular-nums">{formatChf(order.totals.totalCents)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {VAT_INCLUSIVE_NOTE} · Zahlungsreferenz {order.payment.reference}
          </p>

          <Separator />

          <div className="grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="mb-1 font-medium">Lieferadresse</h2>
              <address className="not-italic text-muted-foreground">
                {order.customer.name}
                <br />
                {order.customer.street}
                <br />
                {order.customer.postalCode} {order.customer.city}
                <br />
                {order.customer.country}
              </address>
            </div>
            <div>
              <h2 className="mb-1 font-medium">Kontakt</h2>
              <p className="text-muted-foreground">
                {order.customer.email}
                <br />
                {order.customer.phone}
              </p>
              <p className="mt-2 text-muted-foreground">
                Bestellt am {formatDateTime(new Date(order.createdAt))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrderPage({ params }: PagePropsLocal) {
  return <OrderView params={params} />;
}
