export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierForm } from "@/components/admin/supplier-form";
import { getSupplierById, listSuppliers } from "@/server/purchasing";

export const metadata: Metadata = {
  title: "Lieferanten — Admin",
  description: "Lieferanten verwalten.",
};

async function SuppliersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : undefined;
  const [suppliers, editing] = await Promise.all([
    listSuppliers(),
    editId ? getSupplierById(editId) : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Lieferanten</h1>

      {editing && (
        <Card className="mt-6 border-primary/40">
          <CardHeader>
            <CardTitle>Lieferant bearbeiten: {editing.name}</CardTitle>
            <CardDescription>
              Änderungen übernehmen oder{" "}
              <Link
                href="/admin/suppliers"
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                abbrechen
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SupplierForm supplier={editing} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Neuer Lieferant</CardTitle>
          <CardDescription>Name und E-Mail sind Pflichtfelder.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierForm />
        </CardContent>
      </Card>

      <section className="mt-8" aria-label="Lieferantenliste">
        <h2 className="text-lg font-semibold">Übersicht</h2>
        {suppliers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Noch keine Lieferanten.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">E-Mail</th>
                  <th className="py-2 pr-4 font-medium">Telefon</th>
                  <th className="py-2 pr-4 text-right font-medium">Lieferzeit</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier._id.toString()} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-4 font-medium">{supplier.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{supplier.email}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{supplier.phone ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {supplier.leadTimeDays} Tage
                    </td>
                    <td className="py-2.5 pr-4">
                      {supplier.active ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inaktiv
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="focus-visible:outline-2 focus-visible:outline-ring"
                        asChild
                      >
                        <Link
                          href={`/admin/suppliers?edit=${supplier._id.toString()}`}
                          aria-label={`Lieferant ${supplier.name} bearbeiten`}
                        >
                          Bearbeiten
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SuppliersView searchParams={searchParams} />;
}
