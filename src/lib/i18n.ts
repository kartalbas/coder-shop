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
  // Storefront chrome (#58 step 3 slice): header and footer strings, every one seeded
  // in all five languages — the seed test below fails if a key ships untranslated.
  {
    key: "shop.header.nav.main",
    area: "shop",
    de: "Hauptnavigation",
    texts: {
      fr: "Navigation principale",
      it: "Navigazione principale",
      rm: "Navigaziun principala",
      es: "Navegación principal",
    },
  },
  {
    key: "shop.header.nav.categories",
    area: "shop",
    de: "Kategorien (mobil)",
    texts: {
      fr: "Catégories (mobile)",
      it: "Categorie (mobile)",
      rm: "Categorias (mobil)",
      es: "Categorías (móvil)",
    },
  },
  {
    key: "shop.header.account",
    area: "shop",
    de: "Mein Konto",
    texts: {
      fr: "Mon compte",
      it: "Il mio account",
      rm: "Mes conto",
      es: "Mi cuenta",
    },
  },
  {
    key: "shop.footer.tagline",
    area: "shop",
    de: "Premium-Technik, Schuhe und Kleidung. Alle Preise in CHF inklusive {vat}",
    texts: {
      fr: "Technique premium, chaussures et vêtements. Tous les prix en CHF, {vat} inclus",
      it: "Tecnica premium, scarpe e abbigliamento. Tutti i prezzi in CHF, {vat} inclusa",
      rm: "Tecnica premium, chaussas e vestgadira. Tut ils pretschs en CHF, {vat} inclus",
      es: "Tecnología premium, calzado y ropa. Todos los precios en CHF, {vat} incluido",
    },
  },
  {
    key: "shop.footer.assortment",
    area: "shop",
    de: "Sortiment",
    texts: { fr: "Assortiment", it: "Assortimento", rm: "Sortiment", es: "Surtido" },
  },
  {
    key: "shop.footer.service",
    area: "shop",
    de: "Service",
    texts: { fr: "Service", it: "Servizio", rm: "Servetsch", es: "Servicio" },
  },
  {
    key: "shop.footer.shipping",
    area: "shop",
    de: "Versand aus der Schweiz",
    texts: {
      fr: "Expédition depuis la Suisse",
      it: "Spedizione dalla Svizzera",
      rm: "Spedition da la Svizra",
      es: "Envío desde Suiza",
    },
  },
  {
    key: "shop.footer.payment",
    area: "shop",
    de: "Zahlung in CHF",
    texts: { fr: "Paiement en CHF", it: "Pagamento in CHF", rm: "Pajament en CHF", es: "Pago en CHF" },
  },
  {
    key: "shop.footer.returns",
    area: "shop",
    de: "14 Tage Rückgaberecht",
    texts: {
      fr: "Droit de retour de 14 jours",
      it: "Diritto di recesso di 14 giorni",
      rm: "Dretg da revista da 14 dis",
      es: "Derecho de devolución de 14 días",
    },
  },
  {
    key: "shop.footer.copyright",
    area: "shop",
    de: "coder-shop — Demo-Shop",
    texts: {
      fr: "coder-shop — boutique de démonstration",
      it: "coder-shop — negozio dimostrativo",
      rm: "coder-shop — shop da demo",
      es: "coder-shop — tienda de demostración",
    },
  },
  // Page metadata (#58 step 3): titles and descriptions per page, {placeholders} for
  // the VAT label and the order number.
  {
    key: "shop.meta.products.title",
    area: "shop",
    de: "Alle Produkte",
    texts: { fr: "Tous les produits", it: "Tutti i prodotti", rm: "Tut ils products", es: "Todos los productos" },
  },
  {
    key: "shop.meta.products.description",
    area: "shop",
    de: "Das Sortiment des coder-shop — filterbar nach Marke und den Attributen der Produkte.",
    texts: {
      fr: "L'assortiment de coder-shop — filtrable par marque et par attribut des produits.",
      it: "L'assortimento di coder-shop — filtrabile per marca e attributi dei prodotti.",
      rm: "Il assortment dal coder-shop — filtrabel ten marca ed attributs dals products.",
      es: "El surtido de coder-shop: filtrable por marca y atributos de los productos.",
    },
  },
  {
    key: "shop.meta.cart.title",
    area: "shop",
    de: "Warenkorb",
    texts: { fr: "Panier", it: "Carrello", rm: "Charret", es: "Cesta" },
  },
  {
    key: "shop.meta.cart.description",
    area: "shop",
    de: "Ihr Warenkorb — coder-shop. Preise in CHF inklusive {vat}",
    texts: {
      fr: "Votre panier — coder-shop. Prix en CHF, {vat} comprise",
      it: "Il vostro carrello — coder-shop. Prezzi in CHF, {vat} inclusa",
      rm: "Voss charret — coder-shop. Pretschs en CHF, {vat} inclus",
      es: "Su cesta — coder-shop. Precios en CHF, {vat} incluido",
    },
  },
  {
    key: "shop.meta.checkout.title",
    area: "shop",
    de: "Kasse",
    texts: { fr: "Caisse", it: "Cassa", rm: "Cassa", es: "Caja" },
  },
  {
    key: "shop.meta.checkout.description",
    area: "shop",
    de: "Adresse, Versand und Zahlung — coder-shop. Preise in CHF inklusive {vat}",
    texts: {
      fr: "Adresse, livraison et paiement — coder-shop. Prix en CHF, {vat} comprise",
      it: "Indirizzo, spedizione e pagamento — coder-shop. Prezzi in CHF, {vat} inclusa",
      rm: "Indiris, spediziun e pajament — coder-shop. Pretschs en CHF, {vat} inclus",
      es: "Dirección, envío y pago — coder-shop. Precios en CHF, {vat} incluido",
    },
  },
  {
    key: "shop.meta.compare.title",
    area: "shop",
    de: "Produkte vergleichen",
    texts: {
      fr: "Comparer des produits",
      it: "Confrontare prodotti",
      rm: "Comparar products",
      es: "Comparar productos",
    },
  },
  {
    key: "shop.meta.compare.description",
    area: "shop",
    de: "Bis zu vier Produkte Seite an Seite — Preise, Marken und die Attribute des Typs.",
    texts: {
      fr: "Jusqu'à quatre produits côte à côte — prix, marques et attributs du type.",
      it: "Fino a quattro prodotti fianco a fianco — prezzi, marchi e attributi del tipo.",
      rm: "Fin a quatter products in ina rinfatscha — pretschs, marcas ed attributs dal tip.",
      es: "Hasta cuatro productos lado a lado: precios, marcas y atributos del tipo.",
    },
  },
  {
    key: "shop.meta.order.title",
    area: "shop",
    de: "Bestellung {number}",
    texts: { fr: "Commande {number}", it: "Ordine {number}", rm: "Ordin {number}", es: "Pedido {number}" },
  },
  {
    key: "shop.meta.order.description",
    area: "shop",
    de: "Status und Details Ihrer Bestellung {number} — coder-shop.",
    texts: {
      fr: "Statut et détails de votre commande {number} — coder-shop.",
      it: "Stato e dettagli del vostro ordine {number} — coder-shop.",
      rm: "Status e detagls da voss ordin {number} — coder-shop.",
      es: "Estado y detalles de su pedido {number} — coder-shop.",
    },
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

// The whole table resolved into one plain key→text map for a language (#58 step 3):
// serializable, so a server slot can hand it to client components, which read their
// texts by key without ever seeing the German base of another language.
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
