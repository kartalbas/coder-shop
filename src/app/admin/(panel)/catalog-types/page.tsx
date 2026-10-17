export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCatalogTypes } from "@/server/catalog-types";

export const metadata: Metadata = {
  title: "Katalogtypen — Admin",
  description: "Produkttypen, Dimensionen und Filter als Konfiguration.",
};

export default async function CatalogTypesPage() {
  await connection();
  const types = await getCatalogTypes();
  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Katalogtypen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Produkttypen, ihre Varianten-Dimensionen und Filter sind Konfiguration — ein
            neuer Typ braucht keine Code-Änderung.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/catalog-types/neu">Neuer Typ</Link>
        </Button>
      </div>
      <ul className="mt-6 space-y-3">
        {types.map((type) => (
          <li key={type.key} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {type.label}{" "}
                  <span className="font-mono text-sm text-muted-foreground">{type.key}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {type.dimensions.map((dimension) => dimension.label).join(", ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {type.stockTracking === "serial" ? "Seriennummern" : "Stückzahl"}
                  </Badge>
                  {type.comparable && <Badge variant="secondary">Vergleich</Badge>}
                  <Badge variant="outline">Position {type.position}</Badge>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/catalog-types/${encodeURIComponent(type.key)}`}>Bearbeiten</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
