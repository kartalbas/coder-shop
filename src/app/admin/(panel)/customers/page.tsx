export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { interpolate, label } from "@/lib/i18n";
import { listCustomersCore } from "@/server/customers-admin";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.customers.title"),
    description: label(labels, "admin.meta.customers.description"),
  };
}

// Admin customer list (issue #43): search by name or e-mail, order count and the
// open invoice amount per account at a glance.
async function CustomersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [params, labels] = await Promise.all([searchParams, getRequestLabels()]);
  const f = await getRequestFormatters();
  const query = typeof params.q === "string" ? params.q : "";
  const customers = await listCustomersCore(query);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.customers.title")}</h1>

      <form className="mt-4 flex max-w-sm items-center gap-2" role="search">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={label(labels, "admin.customers.search.placeholder")}
          aria-label={label(labels, "admin.customers.search.aria")}
        />
        <Button type="submit" variant="outline" size="icon" aria-label={label(labels, "shop.action.search")}>
          <Search className="size-4" aria-hidden />
        </Button>
      </form>

      {customers.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {query
            ? interpolate(label(labels, "admin.customers.noMatch"), { q: query })
            : label(labels, "admin.customers.empty")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{label(labels, "admin.customers.column.name")}</th>
                <th className="px-3 py-2 font-medium">{label(labels, "admin.customers.column.email")}</th>
                <th className="px-3 py-2 text-right font-medium">{label(labels, "admin.customers.column.orders")}</th>
                <th className="px-3 py-2 text-right font-medium">{label(labels, "admin.invoices.column.open")}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {customer.name}
                    </Link>
                    {customer.blocked && (
                      <Badge variant="destructive" className="ml-2">
                        {label(labels, "admin.customers.blocked")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{customer.email}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{customer.orderCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {customer.openInvoiceCents > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {f.chf(customer.openInvoiceCents)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CustomersView searchParams={searchParams} />;
}
