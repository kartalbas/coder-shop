import { connectDB } from "./db";
import {
  activeLanguages,
  createTranslator,
  DEFAULT_LANGUAGES,
  DEFAULT_TRANSLATIONS,
  type LanguageConfig,
  type Translator,
  type TranslationEntry,
  TRANSLATION_AREAS,
} from "@/lib/i18n";
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

function validKey(key: string): boolean {
  return /^[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+)+$/.test(key);
}

// Creates or updates one translation row (admin editor, seed, tests). The German base
// text is required; translations may be blank (that is "missing", not invalid) but only
// for language codes that exist as rows — a text for an unknown language is a typo.
export async function saveTranslationCore(
  entry: TranslationEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validKey(entry.key)) {
    return { ok: false, error: `Übersetzungs-Key ungültig: ${entry.key}` };
  }
  if (!TRANSLATION_AREAS.includes(entry.area)) {
    return { ok: false, error: `Übersetzungs-Bereich ungültig: ${entry.area}` };
  }
  if (!entry.de.trim()) return { ok: false, error: `Deutscher Basistext fehlt: ${entry.key}` };
  const known = new Set((await getLanguages()).map((language) => language.code));
  for (const code of Object.keys(entry.texts)) {
    if (!known.has(code)) return { ok: false, error: `Unbekannte Sprache: ${code}` };
  }
  await connectDB();
  await TranslationModel.updateOne(
    { key: entry.key },
    { $set: { key: entry.key, area: entry.area, de: entry.de, texts: entry.texts } },
    { upsert: true },
  ).exec();
  invalidateI18nCache();
  return { ok: true };
}

export async function saveLanguageCore(
  language: LanguageConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[a-z]{2,3}$/.test(language.code)) {
    return { ok: false, error: `Sprachcode ungültig: ${language.code}` };
  }
  if (!language.label.trim()) return { ok: false, error: `Sprachname fehlt: ${language.code}` };
  if (!language.intlLocale.trim()) {
    return { ok: false, error: `Intl-Locale fehlt: ${language.code}` };
  }
  if (!Number.isInteger(language.position)) {
    return { ok: false, error: `Position ungültig: ${language.code}` };
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
