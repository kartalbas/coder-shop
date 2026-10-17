export const instant = false;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Check, Circle, PackageCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatChf, formatDateTime, formatWeight } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";
import { getOrderByNumber, type OrderDto } from "@/server/orders";

const SHIPPING_LABELS: Record<OrderDto["shipping"]["method"], string> = {
  standard: "Standardversand",
  express: "Expressversand",
};

const CHAIN: OrderStatus[] = ["new", "paid", "picking", "packed", "shipped", "delivered"];

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

function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === "cancelled"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : status === "delivered"
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
        : "bg-primary/10 text-primary border-primary/30";
  return <Badge variant="outline" className={tone}>{STATUS_LABELS[status]}</Badge>;
}

function Timeline({ order }: { order: OrderDto }) {
  const reached = new Set(order.statusLog.map((entry) => entry.status));
  if (order.status === "cancelled") {
    const cancelledAt = order.statusLog.find((entry) => entry.status === "cancelled");
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <X className="size-5 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="font-medium text-destructive">Bestellung storniert</p>
          {cancelledAt && (
            <p className="text-sm text-muted-foreground">
              am {formatDateTime(new Date(cancelledAt.at))}
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <ol className="flex flex-wrap gap-y-3" aria-label="Bestellstatus">
      {CHAIN.map((step, index) => {
        const done = reached.has(step);
        const entry = order.statusLog.find((e) => e.status === step);
        return (
          <li key={step} className="flex items-center">
            {index > 0 && <span className="mx-2 h-px w-6 bg-border sm:w-10" aria-hidden />}
            <div className="flex flex-col items-center gap-1 text-center">
              {done ? (
                <Check className="size-5 text-primary" aria-hidden />
              ) : (
                <Circle className="size-5 text-muted-foreground/40" aria-hidden />
              )}
              <span
                className={cn(
                  "text-xs",
                  done ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {STATUS_LABELS[step]}
              </span>
              {entry && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTime(new Date(entry.at))}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

async function OrderView({ params }: PagePropsLocal) {
  await connection();
  const { number } = await params;
  const order = await getOrderByNumber(number);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Vielen Dank für Ihre Bestellung!</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Bestellung {order.orderNumber}
          </h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <Card>
        <CardContent className="space-y-6 p-5 sm:p-6">
          <Timeline order={order} />

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
            8,1 % MwSt. inbegriffen · Zahlungsreferenz {order.payment.reference}
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
