export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatChf } from "@/lib/format";
import { listCustomersCore } from "@/server/customers-admin";

export const metadata: Metadata = {
  title: "Kunden — Admin",
  description: "Kundenkonten mit Bestellungen und offenen Beträgen.",
};

// Admin customer list (issue #43): search by name or e-mail, order count and the
// open invoice amount per account at a glance.
async function CustomersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const customers = await listCustomersCore(query);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>

      <form className="mt-4 flex max-w-sm items-center gap-2" role="search">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Name oder E-Mail suchen"
          aria-label="Kunden durchsuchen"
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Suchen">
          <Search className="size-4" aria-hidden />
        </Button>
      </form>

      {customers.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {query ? `Keine Kunden gefunden für „${query}“.` : "Noch keine Kundenkonten — Kunden registrieren sich im Portal."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">E-Mail</th>
                <th className="px-3 py-2 text-right font-medium">Bestellungen</th>
                <th className="px-3 py-2 text-right font-medium">Offen</th>
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
                        Gesperrt
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{customer.email}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{customer.orderCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {customer.openInvoiceCents > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {formatChf(customer.openInvoiceCents)}
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
