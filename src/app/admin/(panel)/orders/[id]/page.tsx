export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LabelButton } from "@/components/admin/label-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { StatusTimeline } from "@/components/admin/status-timeline";
import { TransitionButtons } from "@/components/admin/transition-buttons";
import { formatChf, formatDate, formatDateTime, formatWeight } from "@/lib/format";
import { PICKUP_PAYMENT_TYPE_LABELS } from "@/lib/payments";
import { PAYMENT_LABELS } from "@/lib/payments";
import { allowedTransitions } from "@/lib/orders/state-machine";
import { getOrderById } from "@/server/orders-admin";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { id } = await params;
  return { title: `Bestellung ${id}`, description: "Bestelldetails und Statuswechsel." };
}

async function OrderDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const targets = allowedTransitions(order.status, {
    paymentMethod: order.payment.method,
    shippingMethod: order.shipping.method,
  });
  const canCreateLabel = order.status === "packed";
  const shipped = order.status === "shipped" || order.status === "delivered";

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zur Übersicht
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Bestellung {order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5" aria-label="Statuswechsel">
        <h2 className="mb-3 text-sm font-semibold">Statuswechsel</h2>
        <TransitionButtons orderId={order._id.toString()} targets={targets} />
        {canCreateLabel && (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Versand</h3>
            <LabelButton orderId={order._id.toString()} />
          </div>
        )}
        {shipped && order.shipping.trackingNumber && (
          <div className="mt-4 border-t pt-4 text-sm">
            <p>
              Sendungsverfolgung:{" "}
              <span className="font-mono font-medium">{order.shipping.trackingNumber}</span>
            </p>
            {order.shipping.parcelWeightGrams !== undefined && (
              <p className="text-muted-foreground">
                Paketgewicht {formatWeight(order.shipping.parcelWeightGrams)}
              </p>
            )}
            {order.shipping.labelPath && (
              <p className="mt-1">
                <Link
                  href={`/admin/labels/${order._id.toString()}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  Etikett öffnen <ExternalLink className="size-3" aria-hidden />
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      {order.shipping.pickup && (
        <section className="mt-6 rounded-xl border bg-card p-5" aria-label="Abholung">
          <h2 className="mb-2 text-sm font-semibold">Abholung im Laden</h2>
          <p className="text-sm">
            Abholcode: <span className="font-mono font-semibold tracking-wider">{order.shipping.pickup.code}</span>
          </p>
          {order.shipping.pickup.pickedUpAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Abgeholt am {formatDateTime(order.shipping.pickup.pickedUpAt)}
              {order.shipping.pickup.paymentType &&
                ` · bezahlt (${PICKUP_PAYMENT_TYPE_LABELS[order.shipping.pickup.paymentType]})`}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Bereitstellen und Übergabe laufen über die Abholungs-Queue.
          </p>
        </section>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5" aria-label="Statusverlauf">
          <h2 className="mb-3 text-sm font-semibold">Verlauf</h2>
          <StatusTimeline entries={order.statusLog} />
        </section>

        <section className="rounded-xl border bg-card p-5 text-sm" aria-label="Kunde und Total">
          <h2 className="mb-3 text-sm font-semibold">Kunde</h2>
          <address className="not-italic text-muted-foreground">
            {order.customer.name}
            <br />
            {order.customer.street}
            <br />
            {order.customer.postalCode} {order.customer.city}
            <br />
            {order.customer.country}
          </address>
          <p className="mt-2 text-muted-foreground">
            {order.customer.email} · {order.customer.phone}
          </p>
          {/* Issue #43: from an order straight to the customer account. */}
          {order.userId && (
            <Link
              href={`/admin/customers/${order.userId}`}
              className="mt-2 inline-block text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Kundenkonto öffnen
            </Link>
          )}
          <dl className="mt-4 space-y-1 border-t pt-4">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Zwischensumme</dt>
              <dd className="tabular-nums">{formatChf(order.totals.subtotalCents)}</dd>
            </div>
            {order.discount && order.discount.cents > 0 && (
              <div className="flex justify-between text-primary">
                <dt>Rabatt ({order.discount.code})</dt>
                <dd className="tabular-nums">−{formatChf(order.discount.cents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Versand</dt>
              <dd className="tabular-nums">
                {order.totals.shippingCents === 0
                  ? "Gratis"
                  : formatChf(order.totals.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatChf(order.totals.totalCents)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2">
              <dt className="text-muted-foreground">Zahlung</dt>
              <dd>{PAYMENT_LABELS[order.payment.method]}</dd>
            </div>
            {order.payment.invoice && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {order.payment.invoice.paidCents >= order.totals.totalCents
                    ? "Rechnung"
                    : "Offen (fällig " + formatDate(order.payment.invoice.dueAt) + ")"}
                </dt>
                <dd className="tabular-nums">
                  {order.totals.totalCents - order.payment.invoice.paidCents > 0
                    ? formatChf(order.totals.totalCents - order.payment.invoice.paidCents)
                    : "bezahlt"}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5" aria-label="Positionen">
        <h2 className="mb-3 text-sm font-semibold">Positionen</h2>
        <ul className="space-y-2 text-sm">
          {order.lines.map((line) => (
            <li key={line.sku} className="flex justify-between gap-4">
              <span className="min-w-0">
                <span className="font-medium">{line.qty}×</span> {line.name}{" "}
                <span className="text-muted-foreground">
                  ({line.variantLabel} · {line.sku})
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatChf(line.totalCents)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AdminOrderDetailPage({ params }: PagePropsLocal) {
  return <OrderDetail params={params} />;
}
