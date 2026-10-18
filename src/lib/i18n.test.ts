import { describe, expect, it } from "vitest";
import {
  activeLanguages,
  createTranslator,
  defaultLanguage,
  DEFAULT_LANGUAGES,
  DEFAULT_TRANSLATIONS,
  filterTranslations,
  interpolate,
  intlLocaleOf,
  isTranslated,
  label,
  labelMap,
  parseAcceptLanguage,
  resolveLanguage,
  textFor,
  type TranslationEntry,
} from "./i18n";

const entry = (over: Partial<TranslationEntry> = {}): TranslationEntry => ({
  key: "shop.action.addToCart",
  area: "shop",
  de: "In den Warenkorb",
  texts: { fr: "Ajouter au panier" },
  ...over,
});

describe("resolveLanguage (issue #58)", () => {
  it("prefers the URL prefix over cookie and browser", () => {
    expect(
      resolveLanguage({
        pathPrefix: "it",
        cookie: "fr",
        acceptLanguage: "es",
        languages: DEFAULT_LANGUAGES,
      }),
    ).toBe("it");
  });

  it("falls back cookie → browser → first active language", () => {
    const base = { languages: DEFAULT_LANGUAGES };
    expect(resolveLanguage({ ...base, cookie: "fr", acceptLanguage: "es" })).toBe("fr");
    expect(resolveLanguage({ ...base, acceptLanguage: "es" })).toBe("es");
    expect(resolveLanguage(base)).toBe("de");
  });

  it("ignores values outside the active language set at every step", () => {
    const languages = DEFAULT_LANGUAGES.map((language) =>
      language.code === "rm" ? { ...language, active: false } : language,
    );
    const base = { languages };
    expect(resolveLanguage({ ...base, pathPrefix: "rm", cookie: "en", acceptLanguage: "rm" })).toBe(
      "de",
    );
    expect(resolveLanguage({ ...base, pathPrefix: "de", cookie: "fr" })).toBe("de");
  });

  it("normalizes case and junk in prefix and cookie", () => {
    const base = { languages: DEFAULT_LANGUAGES };
    expect(resolveLanguage({ ...base, pathPrefix: " FR " })).toBe("fr");
    expect(resolveLanguage({ ...base, pathPrefix: "../../etc", cookie: "it" })).toBe("it");
  });

  it("uses the first active language as the default, whatever its position", () => {
    const languages = DEFAULT_LANGUAGES.map((language) => ({
      ...language,
      active: language.code === "es" || language.code === "fr",
      position: language.code === "es" ? 0 : 1,
    }));
    expect(defaultLanguage(languages)).toBe("es");
    expect(resolveLanguage({ languages })).toBe("es");
  });
});

describe("parseAcceptLanguage", () => {
  it("orders by q-value and strips regions", () => {
    expect(parseAcceptLanguage("fr-CH,fr;q=0.9,it;q=0.8,de;q=0.5")).toEqual(["fr", "it", "de"]);
    expect(parseAcceptLanguage("de;q=0.3, es ")).toEqual(["es", "de"]);
  });

  it("drops junk, wildcards and q=0", () => {
    expect(parseAcceptLanguage("*;q=0.5, en;q=0, rm")).toEqual(["rm"]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe("textFor / createTranslator (German fallback + missing report)", () => {
  it("answers the language text when present, German when missing or blank", () => {
    expect(textFor(entry(), "fr")).toBe("Ajouter au panier");
    expect(textFor(entry(), "rm")).toBe("In den Warenkorb");
    expect(textFor(entry({ texts: { fr: "  " } }), "fr")).toBe("In den Warenkorb");
    expect(textFor(entry(), "de")).toBe("In den Warenkorb");
    expect(isTranslated(entry(), "it")).toBe(false);
    expect(isTranslated(entry(), "de")).toBe(true);
  });

  it("reports untranslated and unknown keys while serving the fallback", () => {
    const translator = createTranslator([entry()], "es");
    expect(translator.t("shop.action.addToCart")).toBe("In den Warenkorb");
    expect(translator.t("shop.unknown.key")).toBe("shop.unknown.key");
    expect(translator.missingKeys()).toEqual(["shop.action.addToCart", "shop.unknown.key"]);
  });

  it("reports nothing for a fully translated language", () => {
    const translator = createTranslator([entry({ texts: { fr: "Ajouter au panier" } })], "fr");
    expect(translator.t("shop.action.addToCart")).toBe("Ajouter au panier");
    expect(translator.missingKeys()).toEqual([]);
  });
});

describe("DEFAULT_LANGUAGES", () => {
  it("covers the four Swiss national languages plus Spanish with Swiss locales", () => {
    expect(activeLanguages(DEFAULT_LANGUAGES).map((language) => language.code)).toEqual([
      "de",
      "fr",
      "it",
      "rm",
      "es",
    ]);
    expect(DEFAULT_LANGUAGES.find((language) => language.code === "de")?.intlLocale).toBe("de-CH");
    expect(DEFAULT_LANGUAGES.find((language) => language.code === "rm")?.intlLocale).toBe("rm-CH");
    expect(DEFAULT_LANGUAGES.find((language) => language.code === "es")?.intlLocale).toBe("es");
  });
});

describe("intlLocaleOf (#58 step 2b)", () => {
  const languages = [
    { code: "de", label: "Deutsch", intlLocale: "de-CH", position: 0, active: true },
    { code: "fr", label: "Français", intlLocale: "fr-CH", position: 1, active: true },
    { code: "rm", label: "Rumantsch", intlLocale: "rm-CH", position: 2, active: false },
  ];

  it("answers the row's own intlLocale", () => {
    expect(intlLocaleOf(languages, "fr")).toBe("fr-CH");
  });

  it("answers a deactivated row — its formats survive like its texts", () => {
    expect(intlLocaleOf(languages, "rm")).toBe("rm-CH");
  });

  it("an unknown code falls back to the first active row", () => {
    expect(intlLocaleOf(languages, "en")).toBe("de-CH");
  });

  it("an empty table falls back to the base language code", () => {
    expect(intlLocaleOf([], "fr")).toBe("de");
  });
});

describe("labelMap / label / interpolate (#58 step 3)", () => {
  const entries: TranslationEntry[] = [
    { key: "a.b", area: "shop", de: "Hallo {name}", texts: { fr: "Bonjour {name}" } },
    { key: "c.d", area: "shop", de: "Service", texts: {} },
  ];

  it("resolves every key to the language's text with German fallback", () => {
    const labels = labelMap(entries, "fr");
    expect(labels).toEqual({ "a.b": "Bonjour {name}", "c.d": "Service" });
  });

  it("an unknown label answers the key itself — visibly missing", () => {
    expect(label({ "a.b": "x" }, "unknown.key")).toBe("unknown.key");
  });

  it("fills {placeholder} values and leaves unknown ones standing", () => {
    expect(interpolate("Hallo {name}, {vat}", { name: "Welt" })).toBe("Hallo Welt, {vat}");
  });
});

describe("seed translations (#58 — no key ships untranslated)", () => {
  it("every seeded key has a text in every seeded language", () => {
    for (const entry of DEFAULT_TRANSLATIONS) {
      for (const language of DEFAULT_LANGUAGES) {
        expect(
          isTranslated(entry, language.code),
          `${entry.key} fehlt in ${language.code}`,
        ).toBe(true);
      }
    }
  });
});

describe("filterTranslations (#58 editor)", () => {
  const rows: TranslationEntry[] = [
    entry({ key: "shop.cart.title", de: "Warenkorb", texts: { fr: "Panier" } }),
    entry({ key: "admin.nav.orders", area: "admin", de: "Bestellungen", texts: {} }),
    entry({ key: "mail.order.subject", area: "mail", de: "Ihre Bestellung", texts: { it: "Il tuo ordine" } }),
  ];

  it("returns everything with no filter", () => {
    expect(filterTranslations(rows, {})).toHaveLength(3);
  });

  it("matches key, German base and any language text", () => {
    expect(filterTranslations(rows, { q: "cart" }).map((r) => r.key)).toEqual(["shop.cart.title"]);
    expect(filterTranslations(rows, { q: "bestell" }).map((r) => r.key)).toEqual([
      "admin.nav.orders",
      "mail.order.subject",
    ]);
    expect(filterTranslations(rows, { q: "panier" }).map((r) => r.key)).toEqual(["shop.cart.title"]);
  });

  it("filters by area and combines with the text search", () => {
    expect(filterTranslations(rows, { area: "mail" }).map((r) => r.key)).toEqual(["mail.order.subject"]);
    expect(filterTranslations(rows, { area: "shop", q: "warenkorb" }).map((r) => r.key)).toEqual([
      "shop.cart.title",
    ]);
    expect(filterTranslations(rows, { area: "admin", q: "panier" })).toEqual([]);
  });

  it("keeps only rows missing a text in the chosen language, combined with the rest", () => {
    // fr: only shop.cart.title has it → the other two are missing.
    expect(filterTranslations(rows, { missingFor: "fr" }).map((r) => r.key)).toEqual([
      "admin.nav.orders",
      "mail.order.subject",
    ]);
    // it: only mail.order.subject has it.
    expect(filterTranslations(rows, { missingFor: "it" }).map((r) => r.key)).toEqual([
      "shop.cart.title",
      "admin.nav.orders",
    ]);
    // German is the base — nothing is ever missing in it.
    expect(filterTranslations(rows, { missingFor: "de" })).toEqual([]);
    // combines with area and text search.
    expect(
      filterTranslations(rows, { missingFor: "fr", area: "admin" }).map((r) => r.key),
    ).toEqual(["admin.nav.orders"]);
    expect(filterTranslations(rows, { missingFor: "it", q: "panier" }).map((r) => r.key)).toEqual(
      ["shop.cart.title"],
    );
    expect(filterTranslations(rows, { missingFor: "fr", q: "panier" })).toEqual([]);
  });
});
