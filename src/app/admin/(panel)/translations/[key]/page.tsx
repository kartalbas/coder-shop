export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { TranslationEditor } from "@/components/admin/translation-editor";
import { interpolate, label } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";
import { previewPathFor, previewTemplateFor } from "@/lib/translation-previews";
import { usageFilesFor } from "@/lib/translation-usage";
import {
  getLanguages,
  getRequestFormatters,
  getRequestLabels,
  getTranslationHistory,
  getTranslations,
} from "@/server/i18n";
import { PREVIEW_TABLE, resolvePreviewSamples } from "@/server/translation-previews";
import { TRANSLATION_USAGE } from "@/server/translation-usage";

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

// "new" opens the editor with an empty row; every other segment edits that key.
// The sentinel is English (#63 machine-value rule, #58 editor slice); a translation
// key always contains a dot, so "new" and "languages" can never collide with a real
// key, and an old German "/neu" bookmark falls to the key lookup and 404s cleanly.
export default async function TranslationEditPage({ params }: PagePropsLocal) {
  await connection();
  const { key } = await params;
  const labels = await getRequestLabels();
  const decoded = decodeURIComponent(key);
  // All languages, active and inactive (#58 review): the editor shows every text —
  // including deactivated ones, marked as such — so editing a row can never drop the
  // texts of a language that is only temporarily off.
  const [entries, languages] = await Promise.all([getTranslations(), getLanguages()]);
  const entry = decoded === "new" ? null : (entries.find((row) => row.key === decoded) ?? null);
  // The change history of this key (#58 editor slice): the last changes with actor and
  // timestamps, rendered in the request language with its Formatters.
  const [history, formatters] = await Promise.all([
    entry ? getTranslationHistory(entry.key) : Promise.resolve([]),
    getRequestFormatters(),
  ]);
  const languageLabel = new Map(languages.map((language) => [language.code, language.label]));
  // Usage context + preview links (#58 editor slice): usage is the checked-in
  // extraction from the code, the preview route comes from the preview table — both
  // plain data, one preview link per active language row via the shared localizedPath.
  const usage = entry ? usageFilesFor(TRANSLATION_USAGE, entry.key) : [];
  const adminHrefs = ADMIN_NAV.map((item) => item.href);
  const template = entry ? previewTemplateFor(entry.key, PREVIEW_TABLE, adminHrefs) : null;
  const previewPath =
    entry && template !== null
      ? previewPathFor(entry.key, PREVIEW_TABLE, await resolvePreviewSamples(template), adminHrefs)
      : null;
  // Storefront previews exist per language (the prefix selects it); admin URLs are
  // prefix-free and follow the shared language cookie, so one link answers there.
  const previews =
    previewPath === null || previewPath.startsWith("/admin")
      ? []
      : languages
          .filter((language) => language.active)
          .map((language) => ({
            code: language.code,
            name: language.label,
            href: localizedPath(language.code, previewPath),
          }));
  if (decoded !== "new" && !entry) {
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

      {entry && (
        <section className="mt-10" aria-labelledby="translation-usage-heading">
          <h2 id="translation-usage-heading" className="text-lg font-semibold tracking-tight">
            {label(labels, "admin.translations.usage.title")}
          </h2>
          {usage.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {label(labels, "admin.translations.usage.none")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {usage.map((file) => (
                <li key={file} className="break-all">
                  {file}
                </li>
              ))}
            </ul>
          )}
          {previewPath !== null && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                {label(labels, "admin.translations.usage.preview")}
              </span>
              {previewPath.startsWith("/admin") ? (
                <a
                  href={previewPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm font-mono text-xs underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {previewPath}
                </a>
              ) : (
                  previews.map((preview) => (
                    <a
                      key={preview.code}
                      href={preview.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={interpolate(
                        label(labels, "admin.translations.usage.previewAria"),
                        { language: preview.name },
                      )}
                      className="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {preview.name}
                    </a>
                  ))
                )}
              </p>
            )}
        </section>
      )}

      {entry && (
        <section className="mt-10" aria-labelledby="translation-history-heading">
          <h2 id="translation-history-heading" className="text-lg font-semibold tracking-tight">
            {label(labels, "admin.translations.history.title")}
          </h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {label(labels, "admin.translations.history.empty")}
            </p>
          ) : (
            <ul className="mt-3 max-w-3xl space-y-2">
              {history.map((change) => (
                <li key={change.id} className="rounded-lg border p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {languageLabel.get(change.language) ?? change.language}
                    </span>
                    <span>{formatters.dateTime(change.at)}</span>
                    <span>
                      {interpolate(label(labels, "admin.translations.history.actor"), {
                        actor: change.actor ?? label(labels, "admin.translations.history.system"),
                      })}
                    </span>
                  </p>
                  <p className="mt-1 break-words">
                    {change.oldValue || (
                      <span className="italic text-muted-foreground">
                        {label(labels, "admin.translations.missing")}
                      </span>
                    )}
                    <span aria-hidden className="mx-1.5 text-muted-foreground">
                      →
                    </span>
                    <span className="sr-only">{label(labels, "admin.translations.history.to")}</span>
                    {change.newValue || (
                      <span className="italic text-muted-foreground">
                        {label(labels, "admin.translations.missing")}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
