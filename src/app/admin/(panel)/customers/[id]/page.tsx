export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  BlockAccountButton,
  CustomerNotesForm,
  ResetPasswordButton,
} from "@/components/admin/customer-actions";
import { Badge } from "@/components/ui/badge";
import { formatChf, formatDate } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { DEFAULT_CREDIT_LIMIT_CENTS } from "@/lib/invoices";
import { getCustomerDetailCore } from "@/server/customers-admin";
import { getRequestLabels } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.customerDetail.title"),
    description: label(labels, "admin.meta.customerDetail.description"),
  };
}

// Customer detail (issue #43): everything the admin needs about one account —
// orders, open invoice amounts, credit, addresses, internal notes, block and reset.
async function CustomerView({ id }: { id: string }) {
  await connection();
  const [customer, labels] = await Promise.all([getCustomerDetailCore(id), getRequestLabels()]);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
        {customer.blocked && (
          <Badge variant="destructive">{label(labels, "admin.customers.blocked")}</Badge>
        )}
        <Link
          href="/admin/customers"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          ← {label(labels, "admin.customers.back")}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{customer.email}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label={label(labels, "admin.orders.title")} className="space-y-2">
          <h2 className="text-lg font-semibold">{label(labels, "admin.orders.title")}</h2>
          {customer.orders.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {label(labels, "admin.orders.none")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {customer.orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono text-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {order.orderNumber}
                  </Link>
                  <OrderStatusBadge status={order.status} labels={labels} />
                  <span className="tabular-nums">{formatChf(order.totalCents)}</span>
                  <span className="text-muted-foreground">{formatDate(order.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section aria-label={label(labels, "admin.customers.invoices.title")} className="space-y-2">
            <h2 className="text-lg font-semibold">
              {label(labels, "admin.customers.invoices.title")}
              {customer.openTotalCents > 0 && (
                <span className="ml-2 text-base font-medium text-amber-700 dark:text-amber-400">
                  {formatChf(customer.openTotalCents)}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {interpolate(label(labels, "admin.customers.credit"), {
                amount: formatChf(customer.creditLimitCents ?? DEFAULT_CREDIT_LIMIT_CENTS),
              })}{" "}
              ·{" "}
              <Link
                href="/admin/invoices"
                className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label(labels, "admin.customers.invoices.link")}
              </Link>
            </p>
            {customer.openInvoices.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {label(labels, "admin.customers.invoices.empty")}
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {customer.openInvoices.map((invoice) => (
                  <li key={invoice.orderNumber} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <Link
                      href={invoice.orderId ? `/admin/orders/${invoice.orderId}` : "/admin/invoices"}
                      className="font-mono text-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {invoice.orderNumber}
                    </Link>
                    {invoice.overdue && (
                      <Badge variant="destructive">{label(labels, "admin.invoices.overdue")}</Badge>
                    )}
                    <span className="tabular-nums">{formatChf(invoice.openCents)}</span>
                    <span className="text-muted-foreground">
                      {interpolate(label(labels, "admin.customers.invoices.due"), {
                        date: formatDate(invoice.dueAt),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={label(labels, "admin.customers.addresses.title")} className="space-y-2">
            <h2 className="text-lg font-semibold">{label(labels, "admin.customers.addresses.title")}</h2>
            {customer.addresses.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {label(labels, "admin.customers.addresses.empty")}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {customer.addresses.map((address, index) => (
                  <li key={index} className="rounded-md border px-3 py-2 text-sm">
                    <p className="font-medium">
                      {address.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {address.kind === "billing"
                          ? label(labels, "admin.customers.address.kind.billing")
                          : label(labels, "admin.customers.address.kind.shipping")}
                        {address.isDefault && ` · ${label(labels, "admin.customers.address.default")}`}
                      </span>
                    </p>
                    <p className="text-muted-foreground">{address.street}</p>
                    <p className="text-muted-foreground">
                      {address.postalCode} {address.city}, {address.country}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label={label(labels, "admin.customers.manage.title")} className="space-y-3">
          <h2 className="text-lg font-semibold">{label(labels, "admin.customers.manage.title")}</h2>
          <div className="flex flex-wrap gap-2">
            <BlockAccountButton customerId={customer.id} blocked={customer.blocked} />
            <ResetPasswordButton customerId={customer.id} />
          </div>
          <p className="text-xs text-muted-foreground">{label(labels, "admin.customers.manage.note")}</p>
        </section>
        <section aria-label={label(labels, "admin.customers.notes.title")} className="space-y-2">
          <h2 className="text-lg font-semibold">{label(labels, "admin.customers.notes.title")}</h2>
          <CustomerNotesForm customerId={customer.id} notes={customer.notes} />
        </section>
      </div>
    </div>
  );
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerView id={id} />;
}
