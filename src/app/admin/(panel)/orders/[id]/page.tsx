export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LabelButton } from "@/components/admin/label-actions";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { StatusTimeline } from "@/components/admin/status-timeline";
import { TransitionButtons } from "@/components/admin/transition-buttons";
import { interpolate, label } from "@/lib/i18n";
import { allowedTransitions, flowFlagsFor } from "@/lib/orders/state-machine";
import { paymentMethodByKey } from "@/lib/shop-settings";
import { getOrderById } from "@/server/orders-admin";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import { getShopSettings } from "@/server/shop-settings";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  await connection();
  const [{ id }, labels] = await Promise.all([params, getRequestLabels()]);
  return {
    title: interpolate(label(labels, "admin.orders.heading"), { number: id }),
    description: label(labels, "admin.meta.orderDetail.description"),
  };
}

async function OrderDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const [order, labels] = await Promise.all([getOrderById(id), getRequestLabels()]);
  const f = await getRequestFormatters();
  if (!order) notFound();

  // Issue #64: labels come from the configuration; a retired method falls back to its
  // stored key so old orders stay readable.
  const settings = await getShopSettings();
  const paymentLabel =
    paymentMethodByKey(settings, order.payment.method)?.label ?? order.payment.method;
  const targets = allowedTransitions(
    order.status,
    flowFlagsFor({
      paymentKind: order.payment.kind,
      storePickup: order.shipping.storePickup,
    }),
  );
  const canCreateLabel = order.status === "packed";
  const shipped = order.status === "shipped" || order.status === "delivered";

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {label(labels, "admin.orders.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {interpolate(label(labels, "admin.orders.heading"), { number: order.orderNumber })}
        </h1>
        <OrderStatusBadge status={order.status} labels={labels} />
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5" aria-label={label(labels, "admin.orders.transitions")}>
        <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.orders.transitions")}</h2>
        <TransitionButtons orderId={order._id.toString()} targets={targets} />
        {canCreateLabel && (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">{label(labels, "admin.orders.shipping")}</h3>
            <LabelButton orderId={order._id.toString()} />
          </div>
        )}
        {shipped && order.shipping.trackingNumber && (
          <div className="mt-4 border-t pt-4 text-sm">
            <p>
              {label(labels, "admin.orders.tracking")}{" "}
              <span className="font-mono font-medium">{order.shipping.trackingNumber}</span>
            </p>
            {order.shipping.parcelWeightGrams !== undefined && (
              <p className="text-muted-foreground">
                {interpolate(label(labels, "admin.orders.parcelWeight"), {
                  weight: f.weight(order.shipping.parcelWeightGrams),
                })}
              </p>
            )}
            {order.shipping.labelPath && (
              <p className="mt-1">
                <Link
                  href={`/admin/labels/${order._id.toString()}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {label(labels, "admin.label.open")} <ExternalLink className="size-3" aria-hidden />
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      {order.shipping.pickup && (
        <section className="mt-6 rounded-xl border bg-card p-5" aria-label={label(labels, "admin.orders.pickupAria")}>
          <h2 className="mb-2 text-sm font-semibold">{label(labels, "admin.orders.pickup.title")}</h2>
          <p className="text-sm">
            {label(labels, "admin.orders.pickup.code")}{" "}
            <span className="font-mono font-semibold tracking-wider">{order.shipping.pickup.code}</span>
          </p>
          {order.shipping.pickup.pickedUpAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              {interpolate(label(labels, "admin.orders.pickup.pickedUpAt"), {
                date: f.dateTime(order.shipping.pickup.pickedUpAt),
              })}
              {order.shipping.pickup.paymentType &&
                ` · ${interpolate(label(labels, "admin.orders.pickup.paid"), {
                  type: label(labels, `admin.pickup.paymentType.${order.shipping.pickup.paymentType}`),
                })}`}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {label(labels, "admin.orders.pickup.hint")}
          </p>
        </section>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5" aria-label={label(labels, "admin.orders.historyAria")}>
          <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.orders.history")}</h2>
          <StatusTimeline entries={order.statusLog} labels={labels} formatters={f} />
        </section>

        <section className="rounded-xl border bg-card p-5 text-sm" aria-label={label(labels, "admin.orders.customerAria")}>
          <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.orders.column.customer")}</h2>
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
              {label(labels, "admin.orders.openCustomer")}
            </Link>
          )}
          <dl className="mt-4 space-y-1 border-t pt-4">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{label(labels, "admin.orders.totals.subtotal")}</dt>
              <dd className="tabular-nums">{f.chf(order.totals.subtotalCents)}</dd>
            </div>
            {order.discount && order.discount.cents > 0 && (
              <div className="flex justify-between text-primary">
                <dt>
                  {interpolate(label(labels, "admin.orders.totals.discount"), {
                    code: order.discount.code,
                  })}
                </dt>
                <dd className="tabular-nums">−{f.chf(order.discount.cents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{label(labels, "admin.orders.shipping")}</dt>
              <dd className="tabular-nums">
                {order.totals.shippingCents === 0
                  ? label(labels, "admin.orders.totals.free")
                  : f.chf(order.totals.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>{label(labels, "admin.orders.column.total")}</dt>
              <dd className="tabular-nums">{f.chf(order.totals.totalCents)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2">
              <dt className="text-muted-foreground">{label(labels, "admin.orders.totals.payment")}</dt>
              <dd>{paymentLabel}</dd>
            </div>
            {order.payment.invoice && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {order.payment.invoice.paidCents >= order.totals.totalCents
                    ? label(labels, "admin.orders.totals.invoice")
                    : interpolate(label(labels, "admin.orders.totals.invoiceOpen"), {
                        date: f.date(order.payment.invoice.dueAt),
                      })}
                </dt>
                <dd className="tabular-nums">
                  {order.totals.totalCents - order.payment.invoice.paidCents > 0
                    ? f.chf(order.totals.totalCents - order.payment.invoice.paidCents)
                    : label(labels, "admin.orders.totals.paid")}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5" aria-label={label(labels, "admin.orders.column.items")}>
        <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.orders.column.items")}</h2>
        <ul className="space-y-2 text-sm">
          {order.lines.map((line) => (
            <li key={line.sku} className="flex justify-between gap-4">
              <span className="min-w-0">
                <span className="font-medium">{line.qty}×</span> {line.name}{" "}
                <span className="text-muted-foreground">
                  ({line.variantLabel} · {line.sku})
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{f.chf(line.totalCents)}</span>
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
