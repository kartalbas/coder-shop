export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { FileText, ReceiptText } from "lucide-react";
import { formatChf, formatDate } from "@/lib/format";
import { listInvoicesForUser } from "@/server/invoices";
import { requireCustomerSession } from "@/server/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Rechnungen",
  description: "Offene und bezahlte Rechnungen Ihres Kontos — coder-shop.",
};

// "Offene Rechnungen" of the portal (issue #40): amount, due date, overdue marker, PDF.
export default async function RechnungenPage() {
  await connection();
  const userId = await requireCustomerSession();
  const invoices = await listInvoicesForUser(userId);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-medium">Keine Rechnungen</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Rechnungen erscheinen hier, sobald Sie per Rechnung bestellen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Rechnungen</h2>
      <ul className="space-y-3">
        {invoices.map((invoice) => (
          <li
            key={invoice.orderNumber}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">
                <Link
                  href={`/bestellung/${invoice.orderNumber}`}
                  className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {invoice.orderNumber}
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                {invoice.paid
                  ? `Bezahlt · Total ${formatChf(invoice.totalCents)}`
                  : `Offen ${formatChf(invoice.openCents)} · zahlbar bis ${formatDate(invoice.dueAt)}`}
              </p>
              {invoice.overdue && (
                <p className="mt-1 text-xs font-semibold text-destructive">Überfällig</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  invoice.paid
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : invoice.overdue
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
                )}
              >
                {invoice.paid ? "Bezahlt" : invoice.overdue ? "Überfällig" : "Offen"}
              </span>
              <Link
                href={`/bestellung/${invoice.orderNumber}/rechnung`}
                className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <FileText className="size-4" aria-hidden />
                PDF
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
