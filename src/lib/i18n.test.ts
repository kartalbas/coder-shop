import { describe, expect, it } from "vitest";
import {
  activeLanguages,
  contentLabel,
  createTranslator,
  defaultLanguage,
  DEFAULT_LANGUAGES,
  filterTranslations,
  interpolate,
  intlLocaleOf,
  isTranslated,
  label,
  labelMap,
  needsReview,
  parseAcceptLanguage,
  plural,
  productContentKeys,
  RETIRED_TRANSLATION_KEYS,
  resolveLanguage,
  splitOnPlaceholder,
  textFor,
  type TranslationEntry,
} from "./i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";

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

describe("contentLabel / productContentKeys (#58 step B1a — catalog content)", () => {
  const labels = {
    "catalog.product.demo-1.name": "Veste de montagne",
    "catalog.product.demo-2.name": "   ",
  };

  it("answers the language text when the row exists", () => {
    expect(contentLabel(labels, "catalog.product.demo-1.name", "Bergjacke")).toBe(
      "Veste de montagne",
    );
  });

  it("a missing key falls back to the stored German base, not the key", () => {
    expect(contentLabel(labels, "catalog.product.demo-3.name", "Bergjacke")).toBe("Bergjacke");
  });

  it("a blank text falls back to the German base like textFor does", () => {
    expect(contentLabel(labels, "catalog.product.demo-2.name", "Bergjacke")).toBe("Bergjacke");
  });

  it("productContentKeys is the single source of the content key shape", () => {
    expect(productContentKeys("jack-wolfskin-bergjacke-143")).toEqual({
      name: "catalog.product.jack-wolfskin-bergjacke-143.name",
      description: "catalog.product.jack-wolfskin-bergjacke-143.description",
    });
  });
});

describe("splitOnPlaceholder (#58 step 3)", () => {
  it("splits around the placeholder, keeping the text on both sides", () => {
    expect(splitOnPlaceholder("sichtbar unter {link}.", "link")).toEqual({
      before: "sichtbar unter ",
      after: ".",
    });
  });

  it("a text that leads with the placeholder has an empty before", () => {
    expect(splitOnPlaceholder("{link} — offen", "link")).toEqual({
      before: "",
      after: " — offen",
    });
  });

  it("without the placeholder the whole text is before", () => {
    expect(splitOnPlaceholder("ganz der Text", "link")).toEqual({
      before: "ganz der Text",
      after: "",
    });
  });
});

describe("plural (#58 step 3 — CLDR categories from the data)", () => {
  const labels = {
    "shop.listing.count.one": "{count} produit",
    "shop.listing.count.other": "{count} produits",
    "x.few": "qalil",
    "x.other": "akthar",
  };

  it("de-CH selects other for 0 and one for 1", () => {
    expect(plural(labels, 0, "shop.listing.count", "de-CH")).toBe("{count} produits");
    expect(plural(labels, 1, "shop.listing.count", "de-CH")).toBe("{count} produit");
  });

  it("fr-CH selects one for 0 — the CLDR case the count === 1 branch got wrong", () => {
    expect(plural(labels, 0, "shop.listing.count", "fr-CH")).toBe("{count} produit");
    expect(plural(labels, 2, "shop.listing.count", "fr-CH")).toBe("{count} produits");
  });

  it("a missing category row falls back to .other", () => {
    expect(plural(labels, 1, "shop.reviews.count", "de-CH")).toBe("shop.reviews.count.other");
    expect(plural({ "x.other": "only" }, 1, "x", "de-CH")).toBe("only");
  });

  it("locales with more categories resolve their rows — forms are data, never code", () => {
    expect(plural(labels, 3, "x", "ar")).toBe("qalil");
    expect(plural(labels, 100, "x", "ar")).toBe("akthar");
  });
});

describe("account plural families (#58 — count 1 stays singular in every language)", () => {
  const fr = labelMap(DEFAULT_TRANSLATIONS, "fr");
  const de = labelMap(DEFAULT_TRANSLATIONS, "de");

  it("orders.items counts articles in the CLDR form", () => {
    expect(plural(fr, 1, "shop.account.orders.items", "fr-CH")).toBe("{count} article");
    expect(plural(fr, 2, "shop.account.orders.items", "fr-CH")).toBe("{count} articles");
    expect(plural(de, 1, "shop.account.orders.items", "de-CH")).toBe("{count} Artikel");
    expect(plural(de, 5, "shop.account.orders.items", "de-CH")).toBe("{count} Artikel");
  });

  it("the reorder toasts follow the same families", () => {
    expect(plural(fr, 1, "shop.account.reorder.added", "fr-CH")).toBe("{count} article dans le panier");
    expect(plural(fr, 3, "shop.account.reorder.added", "fr-CH")).toBe("{count} articles dans le panier");
    expect(plural(fr, 1, "shop.account.reorder.skipped", "fr-CH")).toBe("{count} non disponible.");
    expect(plural(fr, 2, "shop.account.reorder.skipped", "fr-CH")).toBe("{count} non disponibles.");
  });

  it("no retired key ships as a live row anymore", () => {
    const keys = new Set(DEFAULT_TRANSLATIONS.map((row) => row.key));
    for (const retired of RETIRED_TRANSLATION_KEYS) {
      expect(keys.has(retired), `${retired} is retired but still seeded`).toBe(false);
    }
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

  it("keeps only rows that need review, per language or in any (#58 editor slice)", () => {
    const fresh = "2026-10-01T10:00:00.000Z";
    const old = "2026-09-01T10:00:00.000Z";
    const reviewed: TranslationEntry[] = [
      entry({
        key: "a.stale.fr",
        texts: { fr: "Panier", it: "Carrello" },
        textUpdatedAt: { de: fresh, fr: old, it: fresh },
      }),
      entry({
        key: "b.all.current",
        texts: { fr: "Bestellungen", it: "Ordini" },
        textUpdatedAt: { de: fresh, fr: fresh, it: fresh },
      }),
      entry({ key: "c.no.timestamps", texts: { fr: "Ordine" } }),
      entry({ key: "d.fr.missing", texts: { it: "Ordine" }, textUpdatedAt: { de: fresh } }),
    ];
    // Any language: only the row with a stale French text flags — a missing text is
    // "missing", not "stale", and rows without timestamps never flag.
    expect(
      filterTranslations(reviewed, { reviewOnly: true }).map((row) => row.key),
    ).toEqual(["a.stale.fr"]);
    // The stale language flags, the current one does not.
    expect(
      filterTranslations(reviewed, { reviewOnly: true, reviewFor: "fr" }).map((row) => row.key),
    ).toEqual(["a.stale.fr"]);
    expect(
      filterTranslations(reviewed, { reviewOnly: true, reviewFor: "it" }).map((row) => row.key),
    ).toEqual([]);
    // Without reviewFor the missingFor language is reviewed (the plan's coupling).
    expect(
      filterTranslations(reviewed, { reviewOnly: true, missingFor: "fr" }).map((row) => row.key),
    ).toEqual([]);
    // Combines with the text search.
    expect(
      filterTranslations(reviewed, { reviewOnly: true, reviewFor: "fr", q: "panier" }).map(
        (row) => row.key,
      ),
    ).toEqual(["a.stale.fr"]);
    expect(filterTranslations(reviewed, { reviewOnly: true, reviewFor: "fr", q: "ordine" })).toEqual(
      [],
    );
  });
});

describe("needsReview (#58 editor slice — texts older than their German base)", () => {
  const fresh = "2026-10-01T10:00:00.000Z";
  const old = "2026-09-01T10:00:00.000Z";

  it("flags a text changed before the German base, not one changed after or at it", () => {
    expect(
      needsReview(
        { key: "a.b", area: "shop", de: "x", texts: { fr: "y" }, textUpdatedAt: { de: fresh, fr: old } },
        "fr",
      ),
    ).toBe(true);
    expect(
      needsReview(
        { key: "a.b", area: "shop", de: "x", texts: { fr: "y" }, textUpdatedAt: { de: old, fr: fresh } },
        "fr",
      ),
    ).toBe(false);
    expect(
      needsReview(
        { key: "a.b", area: "shop", de: "x", texts: { fr: "y" }, textUpdatedAt: { de: fresh, fr: fresh } },
        "fr",
      ),
    ).toBe(false);
  });

  it("a missing text is missing, not stale; no timestamps never flag; de never flags", () => {
    expect(
      needsReview({ key: "a.b", area: "shop", de: "x", texts: {}, textUpdatedAt: { de: fresh } }, "fr"),
    ).toBe(false);
    expect(needsReview({ key: "a.b", area: "shop", de: "x", texts: { fr: "y" } }, "fr")).toBe(false);
    expect(
      needsReview(
        { key: "a.b", area: "shop", de: "x", texts: { fr: "y" }, textUpdatedAt: { fr: old } },
        "fr",
      ),
    ).toBe(false);
    expect(
      needsReview(
        { key: "a.b", area: "shop", de: "x", texts: { fr: "y" }, textUpdatedAt: { de: fresh, fr: old } },
        "de",
      ),
    ).toBe(false);
  });
});
