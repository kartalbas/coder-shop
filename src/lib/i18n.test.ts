import { describe, expect, it } from "vitest";
import {
  activeLanguages,
  createTranslator,
  defaultLanguage,
  DEFAULT_LANGUAGES,
  isTranslated,
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
