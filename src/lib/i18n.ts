// Issue #58: all shop languages are data. A language is a row (`LanguageConfig`), a text
// is a row (`TranslationEntry`) with German as the required base and every other language
// as a key in the `texts` map — adding a language or a text never changes code. This
// module is the pure decision layer: which language answers a request, which text a key
// has in it, and which keys are missing.

export interface LanguageConfig {
  code: string;
  label: string;
  intlLocale: string;
  position: number;
  active: boolean;
}

export const BASE_LANGUAGE = "de";

// Issue #58 step 2: the proxy writes this cookie whenever a request arrives with a
// language prefix, so the choice is remembered for prefix-free links and the next visit.
export const LANGUAGE_COOKIE = "lang";

// Seed content of the `languages` collection (#61/#64 pattern): the shop answers in the
// four Swiss national languages plus Spanish; formats follow the Swiss locales.
export const DEFAULT_LANGUAGES: LanguageConfig[] = [
  { code: "de", label: "Deutsch", intlLocale: "de-CH", position: 0, active: true },
  { code: "fr", label: "Français", intlLocale: "fr-CH", position: 1, active: true },
  { code: "it", label: "Italiano", intlLocale: "it-CH", position: 2, active: true },
  { code: "rm", label: "Rumantsch", intlLocale: "rm-CH", position: 3, active: true },
  { code: "es", label: "Español", intlLocale: "es", position: 4, active: true },
];

export const TRANSLATION_AREAS = ["shop", "admin", "mail", "invoice", "catalog"] as const;
export type TranslationArea = (typeof TRANSLATION_AREAS)[number];

export interface TranslationEntry {
  key: string;
  area: TranslationArea;
  de: string;
  texts: Record<string, string>;
}

// Seed content of the `translations` collection — the foundation keys proving the
// mechanism end to end; step 2 of #58 extracts every remaining UI text into rows.
export const DEFAULT_TRANSLATIONS: TranslationEntry[] = [
  {
    key: "shop.header.title",
    area: "shop",
    de: "coder-shop",
    texts: { fr: "coder-shop", it: "coder-shop", rm: "coder-shop", es: "coder-shop" },
  },
  {
    key: "shop.action.addToCart",
    area: "shop",
    de: "In den Warenkorb",
    texts: {
      fr: "Ajouter au panier",
      it: "Aggiungi al carrello",
      rm: "Agiuntar al charret",
      es: "Añadir a la cesta",
    },
  },
  {
    key: "shop.cart.title",
    area: "shop",
    de: "Warenkorb",
    texts: { fr: "Panier", it: "Carrello", rm: "Charret", es: "Cesta" },
  },
];

export function activeLanguages(languages: LanguageConfig[]): LanguageConfig[] {
  return languages
    .filter((language) => language.active)
    .sort((a, b) => a.position - b.position);
}

export function defaultLanguage(languages: LanguageConfig[]): string {
  return activeLanguages(languages)[0]?.code ?? BASE_LANGUAGE;
}

// The Intl locale of a language (#58 step 2b): the row's own `intlLocale` wins, even
// when the row is deactivated (its texts survive, so its formats may still be needed);
// otherwise the first active row, and as a last stand the base language code itself —
// a valid Intl locale that merely formats in the base language.
export function intlLocaleOf(languages: readonly LanguageConfig[], code: string): string {
  return (
    languages.find((language) => language.code === code)?.intlLocale ??
    activeLanguages([...languages])[0]?.intlLocale ??
    BASE_LANGUAGE
  );
}

function normalizeCode(value: string | null | undefined): string | null {
  const code = value?.trim().toLowerCase();
  return code && /^[a-z]{2,3}$/.test(code) ? code : null;
}

// Accept-Language → plain language codes in the client's preference order: q-values
// decide (missing q = 1), region suffixes are stripped (fr-CH → fr), order is stable.
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number(qParam.split("=")[1]) : 1;
      return { code: normalizeCode(tag?.split("-")[0]), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry): entry is { code: string; q: number; index: number } => entry.code !== null)
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .filter((entry, index, sorted) => sorted.findIndex((other) => other.code === entry.code) === index)
    .map((entry) => entry.code);
}

// Precedence per the #58 design: URL prefix wins, then the remembered choice (cookie),
// then the browser, then the first active language. Values outside the active set are
// ignored at every step — a deactivated language never answers.
export function resolveLanguage(input: {
  pathPrefix?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
  languages: LanguageConfig[];
}): string {
  const active = new Set(activeLanguages(input.languages).map((language) => language.code));
  const fromPrefix = normalizeCode(input.pathPrefix);
  if (fromPrefix && active.has(fromPrefix)) return fromPrefix;
  const fromCookie = normalizeCode(input.cookie);
  if (fromCookie && active.has(fromCookie)) return fromCookie;
  for (const code of parseAcceptLanguage(input.acceptLanguage)) {
    if (active.has(code)) return code;
  }
  return defaultLanguage(input.languages);
}

// A missing or blank translation falls back to the German base text — visibly, because
// the translator reports every key that had to fall back.
export function textFor(entry: TranslationEntry, language: string): string {
  if (language === BASE_LANGUAGE) return entry.de;
  const text = entry.texts[language];
  return text && text.trim() ? text : entry.de;
}

export function isTranslated(entry: TranslationEntry, language: string): boolean {
  if (language === BASE_LANGUAGE) return true;
  return Boolean(entry.texts[language]?.trim());
}

// Admin list filter (#58 editor): free text over key, German base and every language
// text, the area, and "missing in language X" — all optional, all combining. The
// missing filter answers the editor's question "what still has to be translated?".
export function filterTranslations(
  entries: readonly TranslationEntry[],
  filter: { q?: string; area?: string; missingFor?: string },
): TranslationEntry[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  return entries.filter((entry) => {
    if (filter.area && entry.area !== filter.area) return false;
    if (filter.missingFor && isTranslated(entry, filter.missingFor)) return false;
    if (!q) return true;
    return [entry.key, entry.de, ...Object.values(entry.texts)]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export interface Translator {
  t(key: string): string;
  missingKeys(): string[];
}

// One table load per request, then pure lookups: unknown keys and untranslated keys
// answer German (unknown keys answer the key itself) and land in the missing report —
// the test hook and the admin "missing translations" view read exactly that.
export function createTranslator(entries: Iterable<TranslationEntry>, language: string): Translator {
  const byKey = new Map<string, TranslationEntry>();
  for (const entry of entries) byKey.set(entry.key, entry);
  const missing = new Set<string>();
  return {
    t(key: string): string {
      const entry = byKey.get(key);
      if (!entry) {
        missing.add(key);
        return key;
      }
      if (!isTranslated(entry, language)) missing.add(key);
      return textFor(entry, language);
    },
    missingKeys(): string[] {
      return [...missing].sort();
    },
  };
}
