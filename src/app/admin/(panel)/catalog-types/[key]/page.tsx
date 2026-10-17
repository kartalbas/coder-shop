export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { CatalogTypeEditor } from "@/components/admin/catalog-type-editor";
import type { CatalogTypeConfig } from "@/lib/catalog-types";
import { getCatalogType } from "@/server/catalog-types";

export const metadata: Metadata = {
  title: "Katalogtyp bearbeiten — Admin",
  description: "Produkttyp und seine Dimensionen konfigurieren.",
};

// "neu" opens the editor with an empty configuration; every other key edits the row.
const NEW_CONFIG: CatalogTypeConfig = {
  key: "",
  label: "",
  position: 10,
  stockTracking: "quantity",
  comparable: false,
  photoNoun: "",
  brands: [],
  dimensions: [{ key: "color", label: "Farbe", facet: true, order: "alpha" }],
};

interface PagePropsLocal {
  params: Promise<{ key: string }>;
}

export default async function CatalogTypeEditPage({ params }: PagePropsLocal) {
  await connection();
  const { key } = await params;
  const config = key === "neu" ? NEW_CONFIG : ((await getCatalogType(key)) ?? null);
  if (!config) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Katalogtyp nicht gefunden</h1>
        <Link href="/admin/catalog-types" className="mt-3 inline-block text-sm underline">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/catalog-types"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zur Übersicht
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {key === "neu" ? "Neuer Katalogtyp" : `Katalogtyp bearbeiten: ${config.label}`}
      </h1>
      <div className="mt-6">
        <CatalogTypeEditor config={config} />
      </div>
    </div>
  );
}
