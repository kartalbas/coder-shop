export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { CatalogTypeEditor } from "@/components/admin/catalog-type-editor";
import { CatalogTypeTranslations } from "@/components/admin/catalog-type-translations";
import type { CatalogTypeConfig } from "@/lib/catalog-types";
import { BASE_LANGUAGE, interpolate, label, typeLabelKey } from "@/lib/i18n";
import { getActiveLanguages, getRequestLabels, getTranslations } from "@/server/i18n";
import { getCatalogType } from "@/server/catalog-types";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.catalogTypeEdit.title"),
    description: label(labels, "admin.meta.catalogTypeEdit.description"),
  };
}

// "new" opens the editor with an empty configuration; every other key edits the row.
// The sentinel is English (#63 machine-value rule, #58 editor slice); an old German
// "/neu" bookmark falls to the type lookup and shows the not-found state.
const NEW_CONFIG: CatalogTypeConfig = {
  key: "",
  label: "",
  position: 10,
  stockTracking: "quantity",
  comparable: false,
  photoNoun: "",
  brands: [],
  // #58 step 3: a new dimension starts empty — the label is content the admin types,
  // never a pre-filled German word in code.
  dimensions: [{ key: "color", label: "", facet: true, order: "alpha" }],
};

interface PagePropsLocal {
  params: Promise<{ key: string }>;
}

export default async function CatalogTypeEditPage({ params }: PagePropsLocal) {
  await connection();
  const { key } = await params;
  const labels = await getRequestLabels();
  const config = key === "new" ? NEW_CONFIG : ((await getCatalogType(key)) ?? null);
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
        {key === "new"
          ? label(labels, "admin.catalogTypes.newTitle")
          : interpolate(label(labels, "admin.catalogTypes.editTitle"), { name: config.label })}
      </h1>
      <div className="mt-6">
        <CatalogTypeEditor config={config} />
      </div>
      {/* Issue #58 step B2: an existing type also edits its label's translations —
          the configured label stays the German truth, the active languages minus the
          base drive the block, so a sixth language needs no code change. */}
      {key !== "new" && (
        <div className="mt-6">
          <CatalogTypeLabelTranslations typeKey={config.key} germanLabel={config.label} />
        </div>
      )}
    </div>
  );
}

// The row and the languages are read server-side; the client block only edits.
async function CatalogTypeLabelTranslations({
  typeKey,
  germanLabel,
}: {
  typeKey: string;
  germanLabel: string;
}) {
  const [rows, languages] = await Promise.all([getTranslations(), getActiveLanguages()]);
  return (
    <CatalogTypeTranslations
      typeKey={typeKey}
      germanLabel={germanLabel}
      row={rows.find((row) => row.key === typeLabelKey(typeKey)) ?? null}
      languages={languages.filter((language) => language.code !== BASE_LANGUAGE)}
    />
  );
}
