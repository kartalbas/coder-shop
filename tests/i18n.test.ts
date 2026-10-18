import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGES,
  DEFAULT_TRANSLATIONS,
  type TranslationEntry,
} from "@/lib/i18n";
import { LanguageModel } from "@/models/language";
import { TranslationModel } from "@/models/translation";
import {
  getActiveLanguages,
  getLanguages,
  getTranslations,
  getTranslator,
  invalidateI18nCache,
  saveLanguageCore,
  saveTranslationCore,
} from "@/server/i18n";
import { seedLanguages, seedTranslations } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 foundation: the language and translation tables are the single source —
// the seed is insert-only (#14), the loader caches until a write invalidates it, and
// the translator reports every key that fell back to German.

beforeAll(async () => {
  await connectTestDB();
});

beforeEach(async () => {
  await clearCollections();
  invalidateI18nCache();
});

afterAll(async () => {
  invalidateI18nCache();
  await disconnectTestDB();
});

describe("seed (insert-only, #14)", () => {
  it("seeds the five languages and the foundation keys, and a re-seed keeps edits", async () => {
    await seedLanguages();
    await seedTranslations();
    await seedLanguages();
    await seedTranslations();
    expect((await getLanguages()).map((language) => language.code)).toEqual([
      "de",
      "fr",
      "it",
      "rm",
      "es",
    ]);
    expect(await TranslationModel.countDocuments()).toBe(DEFAULT_TRANSLATIONS.length);

    await TranslationModel.updateOne(
      { key: "shop.cart.title" },
      { $set: { de: "Einkaufswagen" } },
    );
    invalidateI18nCache();
    await seedTranslations();
    const cart = (await getTranslations()).find((entry) => entry.key === "shop.cart.title");
    expect(cart?.de).toBe("Einkaufswagen");
  });
});

describe("loader cache and invalidation", () => {
  it("serves cached rows until a write invalidates them (next request, no deploy)", async () => {
    await seedLanguages();
    await seedTranslations();
    const before = await getTranslator("fr");
    expect(before.t("shop.action.addToCart")).toBe("Ajouter au panier");

    const saved = await saveTranslationCore({
      key: "shop.action.addToCart",
      area: "shop",
      de: "In den Warenkorb",
      texts: { fr: "Zum Warenkorb hinzufügen" },
    });
    expect(saved.ok).toBe(true);

    const after = await getTranslator("fr");
    expect(after.t("shop.action.addToCart")).toBe("Zum Warenkorb hinzufügen");
  });

  it("falls back to the default rows while the collections are empty", async () => {
    expect((await getLanguages()).length).toBe(DEFAULT_LANGUAGES.length);
    expect((await getTranslations()).length).toBe(DEFAULT_TRANSLATIONS.length);
  });
});

describe("saveTranslationCore validation", () => {
  beforeEach(async () => {
    await seedLanguages();
  });

  it("refuses junk keys, missing German and unknown languages", async () => {
    expect((await saveTranslationCore({ key: "no-dot", area: "shop", de: "x", texts: {} })).ok).toBe(
      false,
    );
    expect(
      (await saveTranslationCore({ key: "shop.a.b", area: "shop", de: "  ", texts: {} })).ok,
    ).toBe(false);
    const wrongArea = { key: "shop.a.b", area: "nope", de: "x", texts: {} } as unknown as
      TranslationEntry;
    expect((await saveTranslationCore(wrongArea)).ok).toBe(false);
    expect(
      (
        await saveTranslationCore({ key: "shop.a.b", area: "shop", de: "x", texts: { xx: "y" } })
      ).ok,
    ).toBe(false);
    expect(await TranslationModel.countDocuments()).toBe(0);
  });

  it("accepts a new language as a row and lets its texts be saved", async () => {
    const saved = await saveLanguageCore({
      code: "en",
      label: "English",
      intlLocale: "en-CH",
      position: 5,
      active: true,
    });
    expect(saved.ok).toBe(true);
    expect((await getActiveLanguages()).map((language) => language.code)).toContain("en");
    expect(
      (await saveTranslationCore({ key: "shop.a.b", area: "shop", de: "Hallo", texts: { en: "Hello" } }))
        .ok,
    ).toBe(true);
    expect((await getTranslator("en")).t("shop.a.b")).toBe("Hello");
  });

  it("refuses malformed language rows", async () => {
    expect(
      (await saveLanguageCore({ code: "DE", label: "", intlLocale: "de", position: 0, active: true }))
        .ok,
    ).toBe(false);
    expect(await LanguageModel.countDocuments()).toBe(DEFAULT_LANGUAGES.length);
  });
});
