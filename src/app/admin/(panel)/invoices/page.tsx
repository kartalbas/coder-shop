export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CreditLimitForm, InvoicePaymentForm, ReminderButtons } from "@/components/admin/invoice-actions";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { DEFAULT_CREDIT_LIMIT_CENTS } from "@/lib/invoices";
import { interpolate, label } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import { listInvoiceCredits, listInvoices, type InvoiceFilter } from "@/server/invoices";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.invoices.title"),
    description: label(labels, "admin.meta.invoices.description"),
  };
}

const TABS: { filter: InvoiceFilter; labelKey: string }[] = [
  { filter: "open", labelKey: "admin.invoices.tab.open" },
  { filter: "overdue", labelKey: "admin.invoices.tab.overdue" },
  { filter: "paid", labelKey: "admin.invoices.tab.paid" },
  { filter: "all", labelKey: "admin.action.all" },
];

// Admin invoice bookkeeping (issue #40): filters, payments (also partial), reminder
// levels, and the per-customer credit limits that gate the payment method.
async function InvoicesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [params, labels] = await Promise.all([searchParams, getRequestLabels()]);
  const f = await getRequestFormatters();
  const raw = typeof params.filter === "string" ? params.filter : undefined;
  const filter: InvoiceFilter = TABS.some((tab) => tab.filter === raw)
    ? (raw as InvoiceFilter)
    : "open";
  const [invoices, credits] = await Promise.all([listInvoices(filter), listInvoiceCredits()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.invoices.title")}</h1>

      <nav className="mt-4 flex flex-wrap gap-1 border-b" aria-label={label(labels, "admin.invoices.tabsAria")}>
        {TABS.map(({ filter: tab, labelKey }) => (
          <Link
            key={tab}
            href={tab === "all" ? "/admin/invoices?filter=all" : `/admin/invoices?filter=${tab}`}
            aria-current={tab === filter ? "page" : undefined}
            className={cn(
              "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              tab === filter
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label(labels, labelKey)}
          </Link>
        ))}
      </nav>

      {invoices.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{label(labels, "admin.invoices.empty")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{label(labels, "admin.orders.column.order")}</th>
                <th className="px-4 py-3">{label(labels, "admin.orders.column.customer")}</th>
                <th className="px-4 py-3">{label(labels, "admin.orders.column.status")}</th>
                <th className="px-4 py-3 text-right">{label(labels, "admin.orders.column.total")}</th>
                <th className="px-4 py-3 text-right">{label(labels, "admin.invoices.column.open")}</th>
                <th className="px-4 py-3">{label(labels, "admin.invoices.column.due")}</th>
                <th className="px-4 py-3">{label(labels, "admin.invoices.column.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.orderId} className="border-t align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${invoice.orderId}`}
                      className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {invoice.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">{f.date(invoice.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.customerName}
                    <p className="text-xs text-muted-foreground">{invoice.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={invoice.status} labels={labels} />
                    {invoice.overdue && (
                      <p className="mt-1 text-xs font-semibold text-destructive">
                        {label(labels, "admin.invoices.overdue")}
                      </p>
                    )}
                    {invoice.reminder1At && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {interpolate(label(labels, "admin.invoices.reminder"), {
                          level: 1,
                          date: f.date(invoice.reminder1At),
                        })}
                      </p>
                    )}
                    {invoice.reminder2At && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {interpolate(label(labels, "admin.invoices.reminder"), {
                          level: 2,
                          date: f.date(invoice.reminder2At),
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{f.chf(invoice.totalCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {invoice.openCents > 0 ? (
                      <span className={cn(invoice.overdue && "font-semibold text-destructive")}>
                        {f.chf(invoice.openCents)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{f.date(invoice.dueAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {invoice.openCents > 0 && <InvoicePaymentForm orderId={invoice.orderId} />}
                      {invoice.overdue && invoice.openCents > 0 && (
                        <ReminderButtons
                          orderId={invoice.orderId}
                          hasReminder1={invoice.reminder1At !== undefined}
                          hasReminder2={invoice.reminder2At !== undefined}
                        />
                      )}
                      <Link
                        href={`/admin/invoices/${invoice.orderId}`}
                        target="_blank"
                        className="text-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        PDF
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10" aria-label={label(labels, "admin.invoices.creditAria")}>
        <h2 className="text-lg font-semibold">{label(labels, "admin.invoices.creditAria")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {interpolate(label(labels, "admin.invoices.creditIntro"), {
            amount: f.chf(DEFAULT_CREDIT_LIMIT_CENTS),
          })}
        </p>
        {credits.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {label(labels, "admin.invoices.noCredits")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {credits.map((credit) => (
              <li
                key={credit.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{credit.name}</p>
                  <p className="text-xs text-muted-foreground">{credit.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {interpolate(label(labels, "admin.invoices.used"), {
                      used: f.chf(credit.usedCents),
                      limit: f.chf(credit.creditLimitCents),
                    })}
                  </p>
                </div>
                <CreditLimitForm userId={credit.userId} currentCents={credit.creditLimitCents} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InvoicesView searchParams={searchParams} />;
}
