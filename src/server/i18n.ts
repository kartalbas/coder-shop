import { cookies, headers } from "next/headers";
import { createFormatters, type Formatters } from "@/lib/format";
import { connectDB } from "./db";
import {
  activeLanguages,
  createTranslator,
  defaultLanguage,
  DEFAULT_LANGUAGES,
  intlLocaleOf,
  label,
  labelMap,
  LANGUAGE_COOKIE,
  resolveLanguage,
  type LanguageConfig,
  type Translator,
  type TranslationEntry,
  TRANSLATION_AREAS,
} from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "./translation-seed";
import { LANGUAGE_HEADER } from "@/lib/locale-path";
import { LanguageModel, toLanguageConfig } from "@/models/language";
import { TranslationModel, toTranslationEntry } from "@/models/translation";

// Issue #58: the translation table is read dynamically per request through this single
// access point. The rows are loaded once per process and cached (reads dominate, texts
// change rarely); every write goes through `saveTranslationCore`/`saveLanguageCore`,
// which invalidate the cache — a change takes effect on the next request, no deploy.

interface I18nCache {
  languages: LanguageConfig[] | null;
  translations: TranslationEntry[] | null;
}

const cache: I18nCache = ((globalThis as { __i18nCache?: I18nCache }).__i18nCache ??= {
  languages: null,
  translations: null,
});

export function invalidateI18nCache(): void {
  cache.languages = null;
  cache.translations = null;
}

export async function getLanguages(): Promise<LanguageConfig[]> {
  if (cache.languages) return cache.languages;
  await connectDB();
  const docs = await LanguageModel.find().sort({ position: 1 }).lean().exec();
  cache.languages = docs.length
    ? docs.map((doc) => toLanguageConfig(doc as never))
    : structuredClone(DEFAULT_LANGUAGES);
  return cache.languages;
}

export async function getActiveLanguages(): Promise<LanguageConfig[]> {
  return activeLanguages(await getLanguages());
}

// The Intl locale of a language code (#58 step 2b) — the number, CHF and date formats
// of every storefront render follow the language row, so a new language brings its
// formats without a code change.
export async function getIntlLocale(code: string): Promise<string> {
  return intlLocaleOf(await getLanguages(), code);
}

export async function getTranslations(): Promise<TranslationEntry[]> {
  if (cache.translations) return cache.translations;
  await connectDB();
  const docs = await TranslationModel.find().sort({ key: 1 }).lean().exec();
  cache.translations = docs.length
    ? docs.map((doc) => toTranslationEntry(doc as never))
    : structuredClone(DEFAULT_TRANSLATIONS);
  return cache.translations;
}

// The per-request translator: one table load, then pure lookups with German fallback;
// `missingKeys()` is the report the missing-translations view and tests read.
export async function getTranslator(language: string): Promise<Translator> {
  return createTranslator(await getTranslations(), language);
}

// The whole table as one key→text map for a language (#58 step 3): server slots hand it
// to client components as a serializable prop, so client UIs read their texts from the
// table without a second round-trip and without ever seeing another language's base.
export async function getLabels(language: string): Promise<Record<string, string>> {
  return labelMap(await getTranslations(), language);
}

// The language of the current request (#58 step 3, server-messages slice): the URL
// prefix the proxy hands over as a request header wins (#58 review — a first visit to
// `/fr/…` has no cookie yet, and the global `/_not-found` behind the slug-404 rewrite
// sees neither segment nor cookie), then the remembered choice (the `lang` cookie the
// proxy writes on every prefixed document navigation), then the browser header, then
// the first active row — the same pure precedence the proxy uses, reused not re-spelled.
// Server actions resolve it to build their validation schemas and messages, so a
// customer is answered in the language of the page they are on. Outside a request scope
// (tests, scripts) cookie and headers are unavailable and the first active language
// answers.
export async function getRequestLanguage(): Promise<string> {
  const languages = await getLanguages();
  let pathPrefix: string | null = null;
  let cookie: string | null = null;
  let acceptLanguage: string | null = null;
  try {
    pathPrefix = (await headers()).get(LANGUAGE_HEADER);
    cookie = (await cookies()).get(LANGUAGE_COOKIE)?.value ?? null;
    acceptLanguage = (await headers()).get("accept-language");
  } catch {
    return defaultLanguage(languages);
  }
  return resolveLanguage({ pathPrefix, cookie, acceptLanguage, languages });
}

export async function getRequestLabels(): Promise<Record<string, string>> {
  return getLabels(await getRequestLanguage());
}

// The number, CHF and date formatters of the request language (#58 admin formats slice)
// — the single server-side entry, mirroring getRequestLabels(); outside a request scope
// the first active language answers, so scripts and integration tests stay on the base.
export async function getRequestFormatters(): Promise<Formatters> {
  return createFormatters(await getIntlLocale(await getRequestLanguage()));
}

function validKey(key: string): boolean {
  return /^[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+)+$/.test(key);
}

// Creates or updates one translation row (admin editor, seed, tests). The German base
// text is required; translations may be blank (that is "missing", not invalid) but only
// for language codes that exist as rows — a text for an unknown language is a typo.
// #58 review: `texts` is updated **per code**, never replaced wholesale — a code present
// with a blank value is unset ("cleared this text"), a code absent from the payload
// stays untouched. That way a partial payload (e.g. the editor showing only some
// languages) can never destroy the texts of the languages it did not send, deactivated
// ones included.
export async function saveTranslationCore(
  entry: TranslationEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Issue #58 step 3: refusals answer from the translation table in the request
  // language; outside a request scope the first active language answers.
  const labels = await getRequestLabels();
  if (!validKey(entry.key)) {
    return { ok: false, error: label(labels, "admin.translations.validation.keyShape") };
  }
  if (!TRANSLATION_AREAS.includes(entry.area)) {
    return { ok: false, error: label(labels, "admin.translations.validation.areaInvalid") };
  }
  if (!entry.de.trim()) {
    return { ok: false, error: label(labels, "admin.translations.validation.deRequired") };
  }
  const known = new Set((await getLanguages()).map((language) => language.code));
  for (const code of Object.keys(entry.texts)) {
    if (!known.has(code)) {
      return { ok: false, error: label(labels, "admin.translations.validation.unknownLanguage") };
    }
  }
  const set: Record<string, string> = { key: entry.key, area: entry.area, de: entry.de };
  const unset: Record<string, string> = {};
  for (const [code, text] of Object.entries(entry.texts)) {
    if (text.trim()) set[`texts.${code}`] = text;
    else unset[`texts.${code}`] = "";
  }
  const update: Record<string, Record<string, string>> = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;
  await connectDB();
  await TranslationModel.updateOne({ key: entry.key }, update, { upsert: true }).exec();
  invalidateI18nCache();
  return { ok: true };
}

export async function saveLanguageCore(
  language: LanguageConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Issue #58 step 3: refusals answer from the translation table in the request
  // language; outside a request scope the first active language answers.
  const labels = await getRequestLabels();
  if (!/^[a-z]{2,3}$/.test(language.code)) {
    return { ok: false, error: label(labels, "admin.languages.validation.codeShape") };
  }
  if (!language.label.trim()) {
    return { ok: false, error: label(labels, "admin.languages.validation.nameRequired") };
  }
  if (!language.intlLocale.trim()) {
    return { ok: false, error: label(labels, "admin.languages.validation.localeRequired") };
  }
  if (!Number.isInteger(language.position)) {
    return { ok: false, error: label(labels, "admin.languages.validation.positionInvalid") };
  }
  await connectDB();
  await LanguageModel.updateOne(
    { code: language.code },
    { $set: { ...language } },
    { upsert: true },
  ).exec();
  invalidateI18nCache();
  return { ok: true };
}
