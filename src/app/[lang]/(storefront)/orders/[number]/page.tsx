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
import { interpolate, label } from "@/lib/i18n";
import { HAPPY_PATH, PICKUP_PATH } from "@/lib/orders/state-machine";
import { PICKUP_PAYMENT_TYPE_LABELS } from "@/lib/payments";
import { STORE } from "@/lib/store";
import { mayViewOrderDetails } from "@/server/order-access";
import { getOrderByNumber } from "@/server/orders";
import { OrderAccessForm } from "@/components/storefront/order-access-form";
import { shippingMethodByKey, vatInclusiveNote } from "@/lib/shop-settings";
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
  const vatNote = vatInclusiveNote(settings.vatRatePercent);

  // Pickup QR for the counter (issue #41) — only rendered for the authorized buyer.
  const pickupQr =
    authorized && order.shipping.pickup
      ? await QRCode.toDataURL(order.shipping.pickup.code, { margin: 1, width: 160 })
      : null;

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
          <OrderStatusChain
            status={order.status}
            statusLog={order.statusLog}
            path={order.shipping.storePickup === true ? PICKUP_PATH : HAPPY_PATH}
            intlLocale={intlLocale}
          />

          {order.shipping.trackingNumber && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
              <PackageCheck className="size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  Sendungsverfolgung: {order.shipping.trackingNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shippingLabel}
                  {order.shipping.parcelWeightGrams !== undefined &&
                    ` · Paketgewicht ${weight(order.shipping.parcelWeightGrams)}`}
                </p>
              </div>
            </div>
          )}

          {order.payment.kind === "invoice" && order.payment.invoice && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium">Zahlung per Rechnung</p>
                <p className="text-xs text-muted-foreground">
                  Zahlbar bis {date(new Date(order.payment.invoice.dueAt))} · Referenz{" "}
                  <span className="font-mono">{order.payment.invoice.qrReference}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.payment.invoice.openCents > 0
                    ? `Offen: ${chf(order.payment.invoice.openCents)}`
                    : "Rechnung bezahlt — vielen Dank."}
                </p>
              </div>
              <Link
                href={`/orders/${order.orderNumber}/invoice`}
                className="text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Rechnung als PDF
              </Link>
            </div>
          )}

          {order.shipping.pickup && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/40 p-4">
              <div className="text-sm">
                <p className="font-medium">Abholung im Laden</p>
                <address className="mt-1 not-italic text-xs text-muted-foreground">
                  {STORE.name}
                  <br />
                  {STORE.street}, {STORE.postalCode} {STORE.city}
                  <br />
                  {STORE.hours.join(" · ")}
                </address>
                <p className="mt-2 text-xs text-muted-foreground">
                  {order.status === "picked_up"
                    ? `Abgeholt am ${
                        order.shipping.pickup.pickedUpAt
                          ? dateTime(new Date(order.shipping.pickup.pickedUpAt))
                          : ""
                      }${
                        order.shipping.pickup.paymentType
                          ? ` · bezahlt (${PICKUP_PAYMENT_TYPE_LABELS[order.shipping.pickup.paymentType]})`
                          : ""
                      }`
                    : order.status === "ready"
                      ? "Bereit zur Abholung — Code und QR-Code an der Kasse zeigen."
                      : "Sie erhalten den Abholcode, sobald die Bestellung bereit liegt."}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Abholcode</p>
                  <p className="font-mono text-2xl font-bold tracking-widest">
                    {order.shipping.pickup.code}
                  </p>
                </div>
                {pickupQr && (
                  /* eslint-disable-next-line @next/next/no-img-element -- inline data URL, not an optimizable asset */
                  <img
                    src={pickupQr}
                    alt={`QR-Code mit Abholcode ${order.shipping.pickup.code}`}
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
              <dt className="text-muted-foreground">Zwischensumme</dt>
              <dd className="tabular-nums">{chf(order.totals.subtotalCents)}</dd>
            </div>
            {order.discount && order.discount.cents > 0 && (
              <div className="flex justify-between text-primary">
                <dt>Rabatt ({order.discount.code})</dt>
                <dd className="tabular-nums">−{chf(order.discount.cents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {shippingLabel}
              </dt>
              <dd className="tabular-nums">
                {order.totals.shippingCents === 0
                  ? "Gratis"
                  : chf(order.totals.shippingCents)}
              </dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Gesamt</dt>
              <dd className="tabular-nums">{chf(order.totals.totalCents)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {vatNote} · Zahlungsreferenz {order.payment.reference}
          </p>

          <Separator />

          <div className="grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="mb-1 font-medium">
                {order.shipping.storePickup === true ? "Rechnungsadresse" : "Lieferadresse"}
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
              <h2 className="mb-1 font-medium">Kontakt</h2>
              <p className="text-muted-foreground">
                {order.customer.email}
                <br />
                {order.customer.phone}
              </p>
              <p className="mt-2 text-muted-foreground">
                Bestellt am {dateTime(new Date(order.createdAt))}
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
