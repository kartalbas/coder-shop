export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { TranslationEditor } from "@/components/admin/translation-editor";
import { interpolate, label } from "@/lib/i18n";
import { getLanguages, getRequestLabels, getTranslations } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.translationEdit.title"),
    description: label(labels, "admin.meta.translationEdit.description"),
  };
}

interface PagePropsLocal {
  params: Promise<{ key: string }>;
}

// "neu" opens the editor with an empty row; every other segment edits that key.
// A translation key always contains a dot, so "neu" and "languages" can never collide
// with a real key.
export default async function TranslationEditPage({ params }: PagePropsLocal) {
  await connection();
  const { key } = await params;
  const labels = await getRequestLabels();
  const decoded = decodeURIComponent(key);
  // All languages, active and inactive (#58 review): the editor shows every text —
  // including deactivated ones, marked as such — so editing a row can never drop the
  // texts of a language that is only temporarily off.
  const [entries, languages] = await Promise.all([getTranslations(), getLanguages()]);
  const entry = decoded === "neu" ? null : (entries.find((row) => row.key === decoded) ?? null);
  if (decoded !== "neu" && !entry) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.translations.notFound")}</h1>
        <Link href="/admin/translations" className="mt-3 inline-block text-sm underline">
          {label(labels, "admin.action.back")}
        </Link>
      </div>
    );
  }
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/translations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {label(labels, "admin.action.back")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {entry
          ? interpolate(label(labels, "admin.translations.editTitle"), { key: entry.key })
          : label(labels, "admin.translations.new")}
      </h1>
      <div className="mt-6">
        <TranslationEditor entry={entry} languages={languages} />
      </div>
    </div>
  );
}
