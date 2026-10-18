export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Globe } from "lucide-react";
import { TranslationsTable } from "@/components/admin/translations-table";
import { Button } from "@/components/ui/button";
import {
  BASE_LANGUAGE,
  TRANSLATION_AREAS,
  filterTranslations,
  interpolate,
  label,
} from "@/lib/i18n";
import { getActiveLanguages, getRequestLabels, getTranslations } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.translations.title"),
    description: label(labels, "admin.meta.translations.description"),
  };
}

interface PagePropsLocal {
  searchParams: Promise<{ q?: string; area?: string; missing?: string; review?: string }>;
}

const LIST_LIMIT = 200;

export default async function AdminTranslationsPage({ searchParams }: PagePropsLocal) {
  await connection();
  const { q, area, missing, review } = await searchParams;
  const [entries, languages, labels] = await Promise.all([
    getTranslations(),
    getActiveLanguages(),
    getRequestLabels(),
  ]);
  // Machine values are English (#63): the "no filter" sentinel is "all". The missing
  // and review filters only accept a real active language code and the area filter only
  // the known area enum — junk (or an old `?area=alle` bookmark) falls back to the
  // unfiltered list.
  const missingFor =
    missing && missing !== "all" && languages.some((language) => language.code === missing)
      ? missing
      : undefined;
  const reviewFor =
    review && review !== "all" && languages.some((language) => language.code === review)
      ? review
      : undefined;
  const filtered = filterTranslations(entries, {
    q,
    area: area && (TRANSLATION_AREAS as readonly string[]).includes(area) ? area : undefined,
    missingFor,
    reviewOnly: reviewFor !== undefined,
    reviewFor,
  });
  const shown = filtered.slice(0, LIST_LIMIT);

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.translations.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {label(labels, "admin.translations.intro")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/translations/languages">
              <Globe className="size-4" aria-hidden />
              {label(labels, "admin.translations.languages")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/translations/new">{label(labels, "admin.translations.new")}</Link>
          </Button>
        </div>
      </div>

      <form method="get" action="/admin/translations" className="mt-4 flex max-w-xl flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={label(labels, "admin.translations.searchPlaceholder")}
          aria-label={label(labels, "admin.translations.searchAria")}
          className="h-9 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <select
          name="area"
          defaultValue={area ?? "all"}
          aria-label={label(labels, "admin.translations.areaAria")}
          className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="all">{label(labels, "admin.translations.allAreas")}</option>
          {TRANSLATION_AREAS.map((value) => (
            <option key={value} value={value}>
              {label(labels, `admin.translations.area.${value}`)}
            </option>
          ))}
        </select>
        <select
          name="missing"
          defaultValue={missingFor ?? "all"}
          aria-label={label(labels, "admin.translations.missingAria")}
          className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="all">{label(labels, "admin.translations.allComplete")}</option>
          {languages
            .filter((language) => language.code !== BASE_LANGUAGE)
            .map((language) => (
              <option key={language.code} value={language.code}>
                {interpolate(label(labels, "admin.translations.missingIn"), {
                  language: language.label,
                })}
              </option>
            ))}
        </select>
        <select
          name="review"
          defaultValue={reviewFor ?? "all"}
          aria-label={label(labels, "admin.translations.reviewAria")}
          className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="all">{label(labels, "admin.translations.allReviewed")}</option>
          {languages
            .filter((language) => language.code !== BASE_LANGUAGE)
            .map((language) => (
              <option key={language.code} value={language.code}>
                {interpolate(label(labels, "admin.translations.needsReviewIn"), {
                  language: language.label,
                })}
              </option>
            ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {label(labels, "admin.translations.filter")}
        </button>
      </form>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{label(labels, "admin.translations.empty")}</p>
      ) : (
        <TranslationsTable entries={shown} languages={languages} />
      )}
      {filtered.length > LIST_LIMIT && (
        <p className="mt-3 text-sm text-muted-foreground">
          {interpolate(label(labels, "admin.translations.cap"), {
            limit: LIST_LIMIT,
            total: filtered.length,
          })}
        </p>
      )}
    </div>
  );
}
