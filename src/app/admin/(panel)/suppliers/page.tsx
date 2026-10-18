export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierForm } from "@/components/admin/supplier-form";
import { interpolate, label, splitOnPlaceholder } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { getSupplierById, listSuppliers } from "@/server/purchasing";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.suppliers.title"),
    description: label(labels, "admin.meta.suppliers.description"),
  };
}

async function SuppliersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [params, labels] = await Promise.all([searchParams, getRequestLabels()]);
  const editId = typeof params.edit === "string" ? params.edit : undefined;
  const [suppliers, editing] = await Promise.all([
    listSuppliers(),
    editId ? getSupplierById(editId) : Promise.resolve(null),
  ]);
  const editDescription = splitOnPlaceholder(
    label(labels, "admin.suppliers.editDescription"),
    "link",
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.suppliers.title")}</h1>

      {editing && (
        <Card className="mt-6 border-primary/40">
          <CardHeader>
            <CardTitle>
              {interpolate(label(labels, "admin.suppliers.editTitle"), { name: editing.name })}
            </CardTitle>
            <CardDescription>
              {editDescription.before}
              <Link
                href="/admin/suppliers"
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label(labels, "admin.suppliers.cancel")}
              </Link>
              {editDescription.after}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SupplierForm supplier={editing} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{label(labels, "admin.suppliers.newTitle")}</CardTitle>
          <CardDescription>{label(labels, "admin.suppliers.newDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierForm />
        </CardContent>
      </Card>

      <section className="mt-8" aria-label={label(labels, "admin.suppliers.listAria")}>
        <h2 className="text-lg font-semibold">{label(labels, "admin.suppliers.overview")}</h2>
        {suppliers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {label(labels, "admin.suppliers.empty")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.suppliers.column.name")}</th>
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.suppliers.column.email")}</th>
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.suppliers.column.phone")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.suppliers.column.lead")}</th>
                  <th className="py-2 pr-4 font-medium">{label(labels, "admin.orders.column.status")}</th>
                  <th className="py-2 font-medium">{label(labels, "admin.suppliers.column.action")}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier._id.toString()} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-4 font-medium">{supplier.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{supplier.email}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{supplier.phone ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {interpolate(label(labels, "admin.suppliers.leadDays"), {
                        days: supplier.leadTimeDays,
                      })}
                    </td>
                    <td className="py-2.5 pr-4">
                      {supplier.active ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {label(labels, "admin.suppliers.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {label(labels, "admin.suppliers.inactive")}
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
                          aria-label={interpolate(label(labels, "admin.suppliers.editAria"), {
                            name: supplier.name,
                          })}
                        >
                          {label(labels, "admin.suppliers.edit")}
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
