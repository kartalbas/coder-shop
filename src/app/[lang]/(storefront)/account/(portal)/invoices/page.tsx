export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { FileText, ReceiptText } from "lucide-react";
import { createFormatters } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { getIntlLocale, getLabels } from "@/server/i18n";
import { listInvoicesForUser } from "@/server/invoices";
import { requireCustomerSession } from "@/server/session";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/invoices">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.account.nav.invoices"),
    description: label(labels, "shop.meta.invoices.description"),
  };
}

// "Offene Rechnungen" of the portal (issue #40): amount, due date, overdue marker, PDF.
export default async function RechnungenPage({ params }: PageProps<"/[lang]/account/invoices">) {
  await connection();
  const lang = (await params).lang;
  const userId = await requireCustomerSession();
  // Issue #58 step 2b: dates and amounts follow the request language's Intl locale.
  const [{ chf, date }, labels] = await Promise.all([
    getIntlLocale(lang).then(createFormatters),
    getLabels(lang),
  ]);
  const invoices = await listInvoicesForUser(userId);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <ReceiptText className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-medium">{label(labels, "shop.account.invoices.none")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {label(labels, "shop.account.invoices.emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{label(labels, "shop.account.nav.invoices")}</h2>
      <ul className="space-y-3">
        {invoices.map((invoice) => (
          <li
            key={invoice.orderNumber}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">
                <Link
                  href={`/orders/${invoice.orderNumber}`}
                  className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {invoice.orderNumber}
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                {invoice.paid
                  ? interpolate(label(labels, "shop.account.invoices.paidLine"), {
                      total: chf(invoice.totalCents),
                    })
                  : interpolate(label(labels, "shop.account.invoices.openLine"), {
                      open: chf(invoice.openCents),
                      due: date(invoice.dueAt),
                    })}
              </p>
              {invoice.overdue && (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {label(labels, "shop.state.overdue")}
                </p>
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
                {label(
                  labels,
                  invoice.paid
                    ? "shop.state.paid"
                    : invoice.overdue
                      ? "shop.state.overdue"
                      : "shop.state.open",
                )}
              </span>
              <Link
                href={`/orders/${invoice.orderNumber}/invoice`}
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
