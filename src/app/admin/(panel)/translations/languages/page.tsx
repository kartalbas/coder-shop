export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LanguagesEditor } from "@/components/admin/languages-editor";
import { label } from "@/lib/i18n";
import { getLanguages, getRequestLabels } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.languages.title"),
    description: label(labels, "admin.meta.languages.description"),
  };
}

// Issue #58: a new language is a row here plus its texts — never a code change.
// Rows are deactivated via `active`, never deleted, so their translations survive.
export default async function AdminLanguagesPage() {
  await connection();
  const [languages, labels] = await Promise.all([getLanguages(), getRequestLabels()]);
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/translations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {label(labels, "admin.translations.backToTranslations")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {label(labels, "admin.translations.languages")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.languages.intro")}</p>
      <div className="mt-6">
        <LanguagesEditor languages={languages} />
      </div>
    </div>
  );
}
