export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LanguagesEditor } from "@/components/admin/languages-editor";
import { getLanguages } from "@/server/i18n";

export const metadata: Metadata = {
  title: "Sprachen — Admin",
  description: "Die Sprachen des Shops als Konfiguration.",
};

// Issue #58: a new language is a row here plus its texts — never a code change.
// Rows are deactivated via `active`, never deleted, so their translations survive.
export default async function AdminLanguagesPage() {
  await connection();
  const languages = await getLanguages();
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/translations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zu den Übersetzungen
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Sprachen</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Deutsch ist die Basis und immer aktiv. Eine neue Sprache ist eine Zeile —
        Übersetzungen und Umschalter folgen automatisch. Deaktivieren statt löschen:
        vorhandene Texte einer Sprache bleiben erhalten.
      </p>
      <div className="mt-6">
        <LanguagesEditor languages={languages} />
      </div>
    </div>
  );
}
