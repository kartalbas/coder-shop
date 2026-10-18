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
import QRCode from "qrcode";
import { createFormatters } from "@/lib/format";
import { getIntlLocale, getLabels } from "@/server/i18n";
import { interpolate, label, splitOnPlaceholder } from "@/lib/i18n";
import { HAPPY_PATH, PICKUP_PATH } from "@/lib/orders/state-machine";
import { STORE } from "@/lib/store";
import { mayViewOrderDetails } from "@/server/order-access";
import { getOrderByNumber } from "@/server/orders";
import { OrderAccessForm } from "@/components/storefront/order-access-form";
import { shippingMethodByKey, vatLabel } from "@/lib/shop-settings";
import { getShopSettings } from "@/server/shop-settings";

interface PagePropsLocal {
  params: Promise<{ number: string; lang: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { number, lang } = await params;
  // Issue #58 step 3: metadata texts from the translation table, order number interpolated.
  await connection();
  const labels = await getLabels(lang);
  return {
    title: interpolate(label(labels, "shop.meta.order.title"), { number }),
    description: interpolate(label(labels, "shop.meta.order.description"), { number }),
  };
}

async function OrderView({ params }: PagePropsLocal) {
  await connection();
  const { number, lang } = await params;
  const order = await getOrderByNumber(number);
  if (!order) notFound();

  // Issue #58 step 2b: every number, date and weight on this page follows the
  // language row's intlLocale.
  const intlLocale = await getIntlLocale(lang);
  const { chf, date, dateTime, weight } = createFormatters(intlLocale);
  // Issue #58 step 3: every text on this page comes from the translation table of the
  // request language; the German bases are byte-identical to the literals they replaced.
  const labels = await getLabels(lang);

  // PII (address, e-mail, phone, items, tracking) is only for the buyer — the browser that
  // completed checkout (access cookie), one that verified the order's e-mail, the owning
  // customer account (issue #39), or an admin. Unauthorized visitors never receive the
  // details in the HTML at all.
  const authorized = await mayViewOrderDetails(order.orderNumber);

  // Issue #64: shipping and payment labels come from the configuration; a retired
  // method falls back to its stored key so old orders stay readable.
  const settings = await getShopSettings();
  const shippingLabel =
    shippingMethodByKey(settings, order.shipping.method)?.label ?? order.shipping.method;
  const vatNote = interpolate(label(labels, "shop.checkout.vatNote"), {
    vat: vatLabel(settings.vatRatePercent),
  });

  // Pickup QR for the counter (issue #41) — only rendered for the authorized buyer.
  const pickupQr =
    authorized && order.shipping.pickup
      ? await QRCode.toDataURL(order.shipping.pickup.code, { margin: 1, width: 160 })
      : null;

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{label(labels, "shop.order.thanks")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {interpolate(label(labels, "shop.order.heading"), { number: order.orderNumber })}
        </h1>
      </div>
      <OrderStatusBadge status={order.status} labels={labels} />
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
          <OrderStatusChain
            status={order.status}
            statusLog={order.statusLog}
            path={order.shipping.storePickup === true ? PICKUP_PATH : HAPPY_PATH}
            intlLocale={intlLocale}
            labels={labels}
          />

          {order.shipping.trackingNumber && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
              <PackageCheck className="size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  {interpolate(label(labels, "shop.order.tracking"), {
                    number: order.shipping.trackingNumber,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shippingLabel}
                  {order.shipping.parcelWeightGrams !== undefined &&
                    ` · ${interpolate(label(labels, "shop.order.parcelWeight"), {
                      weight: weight(order.shipping.parcelWeightGrams),
                    })}`}
                </p>
              </div>
            </div>
          )}

          {order.payment.kind === "invoice" && order.payment.invoice && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium">{label(labels, "shop.order.invoice.title")}</p>
                <InvoiceDueLine
                  labels={labels}
                  dueDate={date(new Date(order.payment.invoice.dueAt))}
                  reference={order.payment.invoice.qrReference}
                />
                <p className="text-xs text-muted-foreground">
                  {order.payment.invoice.openCents > 0
                    ? interpolate(label(labels, "shop.order.invoice.open"), {
                        amount: chf(order.payment.invoice.openCents),
                      })
                    : label(labels, "shop.order.invoice.paid")}
                </p>
              </div>
              <Link
                href={`/orders/${order.orderNumber}/invoice`}
                className="text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label(labels, "shop.order.invoice.pdf")}
              </Link>
            </div>
          )}

          {order.shipping.pickup && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/40 p-4">
              <div className="text-sm">
                <p className="font-medium">{label(labels, "shop.order.pickup.title")}</p>
                <address className="mt-1 not-italic text-xs text-muted-foreground">
                  {STORE.name}
                  <br />
                  {STORE.street}, {STORE.postalCode} {STORE.city}
                  <br />
                  {STORE.hours.join(" · ")}
                </address>
                <p className="mt-2 text-xs text-muted-foreground">
                  {order.status === "picked_up"
                    ? `${interpolate(label(labels, "shop.order.pickup.pickedUp"), {
                        datetime: order.shipping.pickup.pickedUpAt
                          ? dateTime(new Date(order.shipping.pickup.pickedUpAt))
                          : "",
                      })}${
                        order.shipping.pickup.paymentType
                          ? ` · ${interpolate(label(labels, "shop.order.pickup.paidVia"), {
                              type: label(
                                labels,
                                `shop.order.pickup.payment.${order.shipping.pickup.paymentType}`,
                              ),
                            })}`
                          : ""
                      }`
                    : order.status === "ready"
                      ? label(labels, "shop.order.pickup.ready")
                      : label(labels, "shop.order.pickup.waiting")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{label(labels, "shop.order.pickup.code")}</p>
                  <p className="font-mono text-2xl font-bold tracking-widest">
                    {order.shipping.pickup.code}
                  </p>
                </div>
                {pickupQr && (
                  /* eslint-disable-next-line @next/next/no-img-element -- inline data URL, not an optimizable asset */
                  <img
                    src={pickupQr}
                    alt={interpolate(label(labels, "shop.order.pickup.qrAlt"), {
                      code: order.shipping.pickup.code,
                    })}
                    width={120}
                    height={120}
                    className="rounded-lg border bg-white p-1"
                  />
                )}
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
                <span className="shrink-0 tabular-nums">{chf(line.totalCents)}</span>
              </li>
            ))}
          </ul>

          <Separator />

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{label(labels, "shop.cart.subtotal")}</dt>
              <dd className="tabular-nums">{chf(order.totals.subtotalCents)}</dd>
            </div>
            {order.discount && order.discount.cents > 0 && (
              <div className="flex justify-between text-primary">
                <dt>
                  {interpolate(label(labels, "shop.order.discount"), { code: order.discount.code })}
                </dt>
                <dd className="tabular-nums">−{chf(order.discount.cents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {shippingLabel}
              </dt>
              <dd className="tabular-nums">
                {order.totals.shippingCents === 0
                  ? label(labels, "shop.checkout.free")
                  : chf(order.totals.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>{label(labels, "shop.checkout.total")}</dt>
              <dd className="tabular-nums">{chf(order.totals.totalCents)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {vatNote} ·{" "}
            {interpolate(label(labels, "shop.order.paymentReference"), {
              reference: order.payment.reference,
            })}
          </p>

          <Separator />

          <div className="grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="mb-1 font-medium">
                {order.shipping.storePickup === true
                  ? label(labels, "shop.order.addressInvoice")
                  : label(labels, "shop.order.addressDelivery")}
              </h2>
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
              <h2 className="mb-1 font-medium">{label(labels, "shop.order.contact")}</h2>
              <p className="text-muted-foreground">
                {order.customer.email}
                <br />
                {order.customer.phone}
              </p>
              <p className="mt-2 text-muted-foreground">
                {interpolate(label(labels, "shop.order.placedAt"), {
                  datetime: dateTime(new Date(order.createdAt)),
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// The QR reference stays a monospace span wherever the language places it — the row
// text is one sentence and splitOnPlaceholder puts the element at the {reference}.
function InvoiceDueLine({
  labels,
  dueDate,
  reference,
}: {
  labels: Record<string, string>;
  dueDate: string;
  reference: string;
}) {
  const { before, after } = splitOnPlaceholder(label(labels, "shop.order.invoice.due"), "reference");
  return (
    <p className="text-xs text-muted-foreground">
      {interpolate(before, { date: dueDate })}
      <span className="font-mono">{reference}</span>
      {after}
    </p>
  );
}

export default function OrderPage({ params }: PagePropsLocal) {
  return <OrderView params={params} />;
}
