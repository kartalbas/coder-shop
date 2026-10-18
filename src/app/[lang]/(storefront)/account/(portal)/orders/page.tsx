export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { ClaimOrderForm } from "@/components/storefront/claim-order-form";
import { ReorderButton } from "@/components/storefront/reorder-button";
import { createFormatters } from "@/lib/format";
import { interpolate, label, plural } from "@/lib/i18n";
import { getIntlLocale, getLabels } from "@/server/i18n";
import { listAccountOrders } from "@/server/account";
import { requireCustomerSession } from "@/server/session";

interface PageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.accountOrders.title"),
    description: label(labels, "shop.meta.accountOrders.description"),
    robots: { index: false },
  };
}

export default async function AccountOrdersPage({
  params,
  searchParams,
}: PageProps) {
  await connection();
  const lang = (await params).lang;
  const userId = await requireCustomerSession();
  // Issue #58 step 2b: dates and amounts follow the request language's Intl locale.
  const [intlLocale, labels] = await Promise.all([getIntlLocale(lang), getLabels(lang)]);
  const { chf, date } = createFormatters(intlLocale);
  const { q } = await searchParams;
  const orders = await listAccountOrders(userId, q ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{label(labels, "shop.account.orders.title")}</h2>
        <ClaimOrderForm />
      </div>

      <form method="get" action="/account/orders" className="flex max-w-sm gap-2">
        <label htmlFor="order-search" className="sr-only">
          {label(labels, "shop.account.orders.searchAria")}
        </label>
        <Input
          id="order-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={label(labels, "shop.account.orders.searchPlaceholder")}
        />
        <Button type="submit" variant="outline">
          {label(labels, "shop.action.search")}
        </Button>
      </form>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {q
              ? interpolate(label(labels, "shop.account.orders.noMatch"), { q })
              : label(labels, "shop.account.orders.none")}
          </p>
          <p className="text-sm text-muted-foreground">
            {q
              ? label(labels, "shop.account.orders.adjustQuery")
              : label(labels, "shop.account.orders.emptyHint")}
          </p>
          {!q && (
            <Button asChild variant="outline">
              <Link href="/products">{label(labels, "shop.account.orders.shopNow")}</Link>
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
                    href={`/orders/${order.orderNumber}`}
                    className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {date(new Date(order.createdAt))} ·{" "}
                    {interpolate(
                      plural(labels, order.itemCount, "shop.account.orders.items", intlLocale),
                      { count: order.itemCount },
                    )}
                    {order.trackingNumber &&
                      ` · ${interpolate(label(labels, "shop.account.orders.shipment"), {
                        tracking: order.trackingNumber,
                      })}`}
                    {/* Issue #41: the pickup code belongs to the order, not the parcel. */}
                    {order.pickupCode &&
                      ` · ${interpolate(label(labels, "shop.account.orders.pickup"), {
                        code: order.pickupCode,
                      })}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} labels={labels} />
                  <span className="tabular-nums font-medium">{chf(order.totalCents)}</span>
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
