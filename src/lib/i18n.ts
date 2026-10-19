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
  // Per-text freshness (#58 editor slice): code → ISO string of the last change,
  // `de` included. Optional so the seed file and its deep-equal guard stay untouched —
  // rows predating the field fall back to the document's createdAt on load, which
  // makes them uniformly current and never flags them for review.
  textUpdatedAt?: Record<string, string>;
}

// Fixed machine-translation repairs (#58 review): the seed is insert-only (#14), so a
// corrected default text would never reach a database seeded before the fix. This list
// names exactly the (key, language) rows whose stored text still equals the flawed
// machine translation — a text an admin has since edited is never touched. Not a
// general update, the same discipline as RETIRED_TRANSLATION_KEYS.
export const TRANSLATION_TEXT_REPAIRS: readonly {
  key: string;
  language: string;
  from: string;
  to: string;
}[] = [
  {
    key: "shop.order.invoice.open",
    language: "it",
    from: "Aperto: {amount}",
    to: "Resto: {amount}",
  },
  {
    key: "shop.order.invoice.open",
    language: "rm",
    from: "Avert: {amount}",
    to: "Restant: {amount}",
  },
  {
    key: "shop.breadcrumbs.aria",
    language: "es",
    from: "Navegación de ruta de navegación",
    to: "Miga de pan",
  },
];

// Code-owned keys renamed by later slices (#58): the seed is insert-only (#14), so a
// rename would leave the old row as dead data in the one table. This fixed list is the
// migration — the seed deletes exactly these keys, nothing else (DECISIONS).
export const RETIRED_TRANSLATION_KEYS: readonly string[] = [
  "shop.listing.countOne",
  "shop.listing.countOther",
  "shop.reviews.countOne",
  "shop.reviews.countOther",
  "shop.stock.low",
  "shop.checkout.shipping",
  "shop.account.orders.items",
  "shop.account.reorder.added",
  "shop.account.reorder.skipped",
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

// Freshness marker (#58 editor slice): a text needs review when it exists but was
// last changed before the German base text — the translation has not caught up with
// its source. ISO strings compare lexicographically; a missing text is "missing",
// not "stale", and rows without timestamps never flag. `de` is just the base code —
// no language branch, a sixth language is judged by the same rule.
export function needsReview(entry: TranslationEntry, code: string): boolean {
  if (code === BASE_LANGUAGE || !isTranslated(entry, code)) return false;
  const textAt = entry.textUpdatedAt?.[code];
  const baseAt = entry.textUpdatedAt?.[BASE_LANGUAGE];
  if (!textAt || !baseAt) return false;
  return textAt < baseAt;
}

// Admin list filter (#58 editor): free text over key, German base and every language
// text, the area, "missing in language X" and "needs review" — all optional, all
// combining. The missing filter answers "what still has to be translated?", the
// review filter "which texts are older than their German base?" — with a language
// given (`reviewFor`, defaulting to `missingFor`) it reviews that language only,
// otherwise a row flags when any language needs review.
export function filterTranslations(
  entries: readonly TranslationEntry[],
  filter: {
    q?: string;
    area?: string;
    missingFor?: string;
    reviewOnly?: boolean;
    reviewFor?: string;
  },
): TranslationEntry[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  return entries.filter((entry) => {
    if (filter.area && entry.area !== filter.area) return false;
    if (filter.missingFor && isTranslated(entry, filter.missingFor)) return false;
    if (filter.reviewOnly) {
      const code = filter.reviewFor ?? filter.missingFor;
      const flagged = code
        ? needsReview(entry, code)
        : Object.keys(entry.texts).some((language) => needsReview(entry, language));
      if (!flagged) return false;
    }
    if (!q) return true;
    return [entry.key, entry.de, ...Object.values(entry.texts)]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

// The whole table resolved into one plain key→text map for a language (#58 step 3):
// serializable, so a server slot can hand it to client components, which read their
// texts by key without ever seeing the German base of another language.
export type LabelMap = Readonly<Record<string, string>>;

export function labelMap(
  entries: Iterable<TranslationEntry>,
  language: string,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of entries) labels[entry.key] = textFor(entry, language);
  return labels;
}

// Reads one label out of a `labelMap` result; an unknown key answers the key itself —
// visibly missing, exactly like the translator's behaviour.
export function label(labels: Readonly<Record<string, string>>, key: string): string {
  return labels[key] ?? key;
}

// Translatable catalog content (#58 step B1a): product names and descriptions are rows
// like any other text, but their fallback is the **stored German base of the document**,
// not the key — a product without a translation must still read as the product it is,
// while an unknown UI key stays visibly missing (`label`'s contract). A present but
// blank text falls back the same way `textFor` does.
export function contentLabel(
  labels: Readonly<Record<string, string>>,
  key: string,
  germanBase: string,
): string {
  const text = labels[key];
  return text && text.trim() ? text : germanBase;
}

// The content keys of one product — the single source of the key shape (area
// `catalog`); the template heads feed the usage extraction and the preview table.
export function productContentKeys(slug: string): { name: string; description: string } {
  return {
    name: `catalog.product.${slug}.name`,
    description: `catalog.product.${slug}.description`,
  };
}

// Fills `{name}` placeholders in a translated text (issue #58 step 3) — the texts stay
// whole sentences per language, the values (VAT label, year, counts) come from code.
export function interpolate(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (match: string, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

// Picks the plural form of a text family (#58 step 3): the CLDR category of the count
// in the language's Intl locale selects the suffixed key (`key.one`, `key.two`, …), so
// a language with more categories is served by adding rows, never by code. A missing
// category row falls back to `key.other`; both unknown answers the key itself.
export function plural(
  labels: Readonly<Record<string, string>>,
  count: number,
  key: string,
  intlLocale: string,
): string {
  const category = new Intl.PluralRules(intlLocale).select(count);
  return labels[`${key}.${category}`] ?? label(labels, `${key}.other`);
}

// Splits a translated text around a `{name}` placeholder (#58 step 3) so a component
// can render its own element (a link) inside a whole sentence — the translator places
// `{link}` wherever the word order of the language needs it. Without the placeholder
// the whole text is `before` and nothing follows it.
export function splitOnPlaceholder(
  text: string,
  name: string,
): { before: string; after: string } {
  const placeholder = `{${name}}`;
  const index = text.indexOf(placeholder);
  if (index === -1) return { before: text, after: "" };
  return { before: text.slice(0, index), after: text.slice(index + placeholder.length) };
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
