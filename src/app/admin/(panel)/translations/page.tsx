export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BASE_LANGUAGE,
  filterTranslations,
  isTranslated,
  type TranslationArea,
} from "@/lib/i18n";
import { getActiveLanguages, getTranslations } from "@/server/i18n";

export const metadata: Metadata = {
  title: "Übersetzungen — Admin",
  description: "Alle Texte des Shops als Zeilen der einen Übersetzungstabelle.",
};

const AREA_LABELS: Record<TranslationArea, string> = {
  shop: "Shop",
  admin: "Admin",
  mail: "Mails",
  invoice: "Rechnungen",
  catalog: "Katalog",
};

interface PagePropsLocal {
  searchParams: Promise<{ q?: string; area?: string; missing?: string }>;
}

const LIST_LIMIT = 200;

export default async function AdminTranslationsPage({ searchParams }: PagePropsLocal) {
  await connection();
  const { q, area, missing } = await searchParams;
  const [entries, languages] = await Promise.all([getTranslations(), getActiveLanguages()]);
  // The missing filter only accepts a real active language code — junk falls back to off.
  const missingFor =
    missing && missing !== "alle" && languages.some((language) => language.code === missing)
      ? missing
      : undefined;
  const filtered = filterTranslations(entries, {
    q,
    area: area && area !== "alle" ? area : undefined,
    missingFor,
  });
  const shown = filtered.slice(0, LIST_LIMIT);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Übersetzungen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jeder Text des Shops ist eine Zeile — Deutsch ist die Pflichtbasis, jede
            andere Sprache ein Eintrag in der Karte. Leer heisst «fehlt» und fällt
            sichtbar auf Deutsch zurück.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/translations/languages">
              <Globe className="size-4" aria-hidden />
              Sprachen
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/translations/neu">Neuer Text</Link>
          </Button>
        </div>
      </div>

      <form method="get" action="/admin/translations" className="mt-4 flex max-w-xl flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Key oder Text suchen…"
          aria-label="Übersetzungen suchen"
          className="h-9 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <select
          name="area"
          defaultValue={area ?? "alle"}
          aria-label="Bereich filtern"
          className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="alle">Alle Bereiche</option>
          {Object.entries(AREA_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="missing"
          defaultValue={missingFor ?? "alle"}
          aria-label="Nach fehlender Übersetzung filtern"
          className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="alle">Alle Sprachen vollständig</option>
          {languages
            .filter((language) => language.code !== BASE_LANGUAGE)
            .map((language) => (
              <option key={language.code} value={language.code}>
                Fehlt in: {language.label}
              </option>
            ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Filtern
        </button>
      </form>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Keine Texte gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Deutsch</th>
                {languages
                  .filter((language) => language.code !== BASE_LANGUAGE)
                  .map((language) => (
                    <th key={language.code} className="px-4 py-2.5 font-medium">
                      {language.label}
                    </th>
                  ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((entry) => (
                <tr key={entry.key} className="border-b last:border-0 align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-mono text-xs font-semibold">{entry.key}</p>
                    <Badge variant="outline" className="mt-1">
                      {AREA_LABELS[entry.area]}
                    </Badge>
                  </td>
                  <td className="max-w-64 px-4 py-2.5">{entry.de}</td>
                  {languages
                    .filter((language) => language.code !== BASE_LANGUAGE)
                    .map((language) => (
                      <td key={language.code} className="max-w-64 px-4 py-2.5">
                        {isTranslated(entry, language.code) ? (
                          entry.texts[language.code]
                        ) : (
                          <span className="text-xs italic text-amber-700 dark:text-amber-400">
                            fehlt
                          </span>
                        )}
                      </td>
                    ))}
                  <td className="px-4 py-2.5 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/translations/${encodeURIComponent(entry.key)}`}>
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
      {filtered.length > LIST_LIMIT && (
        <p className="mt-3 text-sm text-muted-foreground">
          Es werden die ersten {LIST_LIMIT} von {filtered.length} Treffern angezeigt —
          weiter eingrenzen mit der Suche.
        </p>
      )}
    </div>
  );
}
