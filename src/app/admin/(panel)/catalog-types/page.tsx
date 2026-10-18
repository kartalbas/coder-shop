export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { interpolate, label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { getCatalogTypes } from "@/server/catalog-types";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.catalogTypes.title"),
    description: label(labels, "admin.meta.catalogTypes.description"),
  };
}

export default async function CatalogTypesPage() {
  await connection();
  const [types, labels] = await Promise.all([getCatalogTypes(), getRequestLabels()]);
  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.catalogTypes.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {label(labels, "admin.catalogTypes.intro")}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/catalog-types/neu">{label(labels, "admin.catalogTypes.new")}</Link>
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
                    {label(
                      labels,
                      type.stockTracking === "serial"
                        ? "admin.catalogTypes.stockTracking.serial"
                        : "admin.catalogTypes.stockTracking.quantity",
                    )}
                  </Badge>
                  {type.comparable && (
                    <Badge variant="secondary">{label(labels, "admin.catalogTypes.comparableBadge")}</Badge>
                  )}
                  <Badge variant="outline">
                    {interpolate(label(labels, "admin.catalogTypes.positionBadge"), {
                      position: type.position,
                    })}
                  </Badge>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/catalog-types/${encodeURIComponent(type.key)}`}>{label(labels, "admin.action.edit")}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
