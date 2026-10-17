export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CreditLimitForm, InvoicePaymentForm, ReminderButtons } from "@/components/admin/invoice-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatChf, formatDate } from "@/lib/format";
import { DEFAULT_CREDIT_LIMIT_CENTS } from "@/lib/invoices";
import { cn } from "@/lib/utils";
import { listInvoiceCredits, listInvoices, type InvoiceFilter } from "@/server/invoices";

export const metadata: Metadata = {
  title: "Rechnungen — Admin",
  description: "Offene, überfällige und bezahlte Rechnungen, Mahnungen und Kreditlimiten.",
};

const TABS: { filter: InvoiceFilter; label: string }[] = [
  { filter: "open", label: "Offen" },
  { filter: "overdue", label: "Überfällig" },
  { filter: "paid", label: "Bezahlt" },
  { filter: "all", label: "Alle" },
];

// Admin invoice bookkeeping (issue #40): filters, payments (also partial), reminder
// levels, and the per-customer credit limits that gate the payment method.
async function InvoicesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const raw = typeof params.filter === "string" ? params.filter : undefined;
  const filter: InvoiceFilter = TABS.some((tab) => tab.filter === raw)
    ? (raw as InvoiceFilter)
    : "open";
  const [invoices, credits] = await Promise.all([listInvoices(filter), listInvoiceCredits()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Rechnungen</h1>

      <nav className="mt-4 flex flex-wrap gap-1 border-b" aria-label="Rechnungsfilter">
        {TABS.map(({ filter: tab, label }) => (
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
            {label}
          </Link>
        ))}
      </nav>

      {invoices.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Keine Rechnungen in dieser Ansicht.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Bestellung</th>
                <th className="px-4 py-3">Kunde</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Offen</th>
                <th className="px-4 py-3">Fällig</th>
                <th className="px-4 py-3">Aktionen</th>
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
                    <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.customerName}
                    <p className="text-xs text-muted-foreground">{invoice.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={invoice.status} />
                    {invoice.overdue && (
                      <p className="mt-1 text-xs font-semibold text-destructive">Überfällig</p>
                    )}
                    {invoice.reminder1At && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        1. Mahnung {formatDate(invoice.reminder1At)}
                      </p>
                    )}
                    {invoice.reminder2At && (
                      <p className="text-xs text-muted-foreground">
                        2. Mahnung {formatDate(invoice.reminder2At)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatChf(invoice.totalCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {invoice.openCents > 0 ? (
                      <span className={cn(invoice.overdue && "font-semibold text-destructive")}>
                        {formatChf(invoice.openCents)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatDate(invoice.dueAt)}</td>
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

      <section className="mt-10" aria-label="Kreditlimiten">
        <h2 className="text-lg font-semibold">Kreditlimiten</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Standard ohne persönlichen Wert: {formatChf(DEFAULT_CREDIT_LIMIT_CENTS)} offene
          Rechnungen pro Konto. 0 sperrt die Zahlungsart für das Konto.
        </p>
        {credits.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Noch keine Konten mit Rechnungbestellungen.
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
                    Ausgenutzt: {formatChf(credit.usedCents)} von {formatChf(credit.creditLimitCents)}
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
