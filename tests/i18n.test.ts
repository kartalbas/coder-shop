import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LANGUAGES,
  RETIRED_TRANSLATION_KEYS,
  type TranslationEntry,
} from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { UserModel } from "@/models/user";
import { LanguageModel } from "@/models/language";
import { TranslationModel } from "@/models/translation";
import { hashPassword } from "@/server/password";
import { createSessionToken } from "@/server/session-token";
import {
  getActiveLanguages,
  getLanguages,
  getTranslations,
  getTranslator,
  invalidateI18nCache,
  saveLanguageCore,
  saveTranslationCore,
} from "@/server/i18n";
import {
  repairTranslationTexts,
  retireTranslations,
  seedLanguages,
  seedTranslations,
} from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// The admin editor actions read the session via next/headers and revalidate caches —
// stub both so the action layer itself can be tested against the real DB.
const store = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (store.token ? { value: store.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import {
  saveLanguageAction,
  saveTranslationAction,
} from "@/server/actions/admin/translations";

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

  it("retires renamed code-owned keys and touches nothing else (#58)", async () => {
    await seedTranslations();
    // Simulate a database seeded before the renames: the old rows exist next to the new.
    await TranslationModel.insertMany(
      RETIRED_TRANSLATION_KEYS.map((key) => ({ key, area: "shop", de: "alt", texts: {} })),
    );
    await retireTranslations();
    const keys = (await TranslationModel.find().lean().exec()).map((row) => row.key);
    for (const retired of RETIRED_TRANSLATION_KEYS) expect(keys).not.toContain(retired);
    expect(keys).toContain("shop.listing.count.one");
    expect(keys).toContain("shop.checkout.legend.shipping");
    expect(await TranslationModel.countDocuments()).toBe(DEFAULT_TRANSLATIONS.length);
  });

  it("repairs flawed machine-translation texts but never an admin edit (#58 review)", async () => {
    await seedLanguages();
    await seedTranslations();
    // Simulate a database seeded before the fixes: the flawed texts are stored.
    await TranslationModel.updateOne(
      { key: "shop.order.invoice.open" },
      { $set: { "texts.it": "Aperto: {amount}", "texts.rm": "Avert: {amount}" } },
    );
    await TranslationModel.updateOne(
      { key: "shop.breadcrumbs.aria" },
      { $set: { "texts.es": "Navegación de ruta de navegación" } },
    );
    expect(await repairTranslationTexts()).toBe(3);
    const invoice = await TranslationModel.findOne({ key: "shop.order.invoice.open" })
      .lean()
      .exec();
    expect(invoice?.texts.it).toBe("Resto: {amount}");
    expect(invoice?.texts.rm).toBe("Restant: {amount}");
    const aria = await TranslationModel.findOne({ key: "shop.breadcrumbs.aria" }).lean().exec();
    expect(aria?.texts.es).toBe("Miga de pan");
    // Idempotent: a second run finds nothing left to repair.
    expect(await repairTranslationTexts()).toBe(0);

    // An admin-edited text differs from the flawed one and is never overwritten.
    await TranslationModel.updateOne(
      { key: "shop.order.invoice.open" },
      { $set: { "texts.it": "Importo aperto: {amount}" } },
    );
    await repairTranslationTexts();
    const edited = await TranslationModel.findOne({ key: "shop.order.invoice.open" })
      .lean()
      .exec();
    expect(edited?.texts.it).toBe("Importo aperto: {amount}");
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

describe("admin editor actions (#58)", () => {
  async function loginAdmin(): Promise<void> {
    const user = await UserModel.create({
      email: "admin@codershop.ch",
      name: "Shop Admin",
      passwordHash: await hashPassword("I18n!2026"),
      role: "admin",
    });
    store.token = createSessionToken(user._id.toString());
  }

  function translationForm(payload: unknown): FormData {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    return formData;
  }

  it("saves a new text through the action and the translator answers it", async () => {
    await loginAdmin();
    await seedLanguages();
    const result = await saveTranslationAction(
      null,
      translationForm({
        key: "shop.editor.roundtrip",
        area: "shop",
        de: "Rücklauf",
        texts: { fr: "Retour" },
      }),
    );
    expect(result).toEqual({ ok: true });
    const entry = (await getTranslations()).find((row) => row.key === "shop.editor.roundtrip");
    expect(entry?.texts.fr).toBe("Retour");
    expect((await getTranslator("fr")).t("shop.editor.roundtrip")).toBe("Retour");
  });

  it("refuses junk payloads and unknown language codes without writing", async () => {
    await loginAdmin();
    await seedLanguages();
    expect((await saveTranslationAction(null, translationForm("quatsch"))).ok).toBe(false);
    expect(
      (
        await saveTranslationAction(
          null,
          translationForm({ key: "no-dot", area: "shop", de: "x", texts: {} }),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await saveTranslationAction(
          null,
          translationForm({ key: "shop.a.b", area: "shop", de: "x", texts: { xx: "y" } }),
        )
      ).ok,
    ).toBe(false);
    expect(await TranslationModel.countDocuments()).toBe(0);
  });

  it("editing a row preserves the texts of deactivated languages (#58 review)", async () => {
    await loginAdmin();
    await seedLanguages();
    await seedTranslations();
    expect(
      (
        await saveTranslationAction(
          null,
          translationForm({
            key: "shop.cart.title",
            area: "shop",
            de: "Warenkorb",
            texts: { fr: "Panier", it: "Carrello" },
          }),
        )
      ).ok,
    ).toBe(true);

    // Deactivate French through the languages editor.
    const fr = (await getLanguages()).find((language) => language.code === "fr")!;
    expect((await saveLanguageAction(null, translationForm({ ...fr, active: false }))).ok).toBe(
      true,
    );

    // The payload the old editor sent: only the active codes, fr absent. The text of
    // the deactivated language must survive the edit of the German base.
    expect(
      (
        await saveTranslationAction(
          null,
          translationForm({
            key: "shop.cart.title",
            area: "shop",
            de: "Warenkorb (korrigiert)",
            texts: { it: "Carrello", rm: "", es: "" },
          }),
        )
      ).ok,
    ).toBe(true);
    const kept = (await getTranslations()).find((row) => row.key === "shop.cart.title");
    expect(kept?.de).toBe("Warenkorb (korrigiert)");
    expect(kept?.texts.fr).toBe("Panier");

    // An explicitly blank value still clears that one text; the others stay.
    expect(
      (
        await saveTranslationAction(
          null,
          translationForm({
            key: "shop.cart.title",
            area: "shop",
            de: "Warenkorb (korrigiert)",
            texts: { fr: "", it: "Carrello" },
          }),
        )
      ).ok,
    ).toBe(true);
    const cleared = (await getTranslations()).find((row) => row.key === "shop.cart.title");
    expect(cleared?.texts.fr).toBeUndefined();
    expect(cleared?.texts.it).toBe("Carrello");
  });

  it("adds a language row through the action — a new language stays a data change", async () => {
    await loginAdmin();
    await seedLanguages();
    const result = await saveLanguageAction(
      null,
      translationForm({ code: "pt", label: "Português", intlLocale: "pt-PT", position: 9, active: true }),
    );
    expect(result).toEqual({ ok: true });
    expect((await getActiveLanguages()).map((language) => language.code)).toContain("pt");

    expect(
      (await saveLanguageAction(null, translationForm({ code: "p", label: "Kurz", intlLocale: "p", position: 0, active: true }))).ok,
    ).toBe(false);
  });
});
