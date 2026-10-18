export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { CatalogTypeEditor } from "@/components/admin/catalog-type-editor";
import type { CatalogTypeConfig } from "@/lib/catalog-types";
import { interpolate, label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { getCatalogType } from "@/server/catalog-types";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.catalogTypeEdit.title"),
    description: label(labels, "admin.meta.catalogTypeEdit.description"),
  };
}

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
  const labels = await getRequestLabels();
  const config = key === "neu" ? NEW_CONFIG : ((await getCatalogType(key)) ?? null);
  if (!config) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.catalogTypes.notFound")}</h1>
        <Link href="/admin/catalog-types" className="mt-3 inline-block text-sm underline">
          {label(labels, "admin.action.back")}
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
        {label(labels, "admin.action.back")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {key === "neu"
          ? label(labels, "admin.catalogTypes.newTitle")
          : interpolate(label(labels, "admin.catalogTypes.editTitle"), { name: config.label })}
      </h1>
      <div className="mt-6">
        <CatalogTypeEditor config={config} />
      </div>
    </div>
  );
}
