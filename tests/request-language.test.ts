import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { LanguageModel } from "@/models/language";
import { checkDiscountCore, createDiscountCore } from "@/server/discounts";
import { getIntlLocale, invalidateI18nCache, getRequestFormatters, getRequestLanguage } from "@/server/i18n";
import { createFormatters } from "@/lib/format";
import { BASE_LANGUAGE, DEFAULT_LANGUAGES, intlLocaleOf } from "@/lib/i18n";
import { seedLanguages } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step 3 (server-messages slice): server actions resolve the request language
// from the `lang` cookie the proxy writes, falling back to Accept-Language and the first
// active row — the same precedence the proxy uses. The mock below plays the request
// scope; without cookie and headers the first active language must answer.

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: undefined as string | undefined,
  pathPrefix: undefined as string | undefined,
  outsideRequest: false,
}));

vi.mock("next/headers", () => ({
  cookies: async () => {
    if (request.outsideRequest) throw new Error("cookies() is only supported in a request");
    return {
      get: () => (request.cookie ? { value: request.cookie } : undefined),
    };
  },
  headers: async () => {
    if (request.outsideRequest) throw new Error("headers() is only supported in a request");
    return {
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === "accept-language") return request.acceptLanguage ?? null;
        if (key === "x-language") return request.pathPrefix ?? null;
        return null;
      },
    };
  },
}));

beforeAll(async () => {
  await connectTestDB();
  await clearCollections();
  invalidateI18nCache();
});

afterEach(() => {
  request.cookie = undefined;
  request.acceptLanguage = undefined;
  request.pathPrefix = undefined;
  request.outsideRequest = false;
});

afterAll(async () => {
  invalidateI18nCache();
  await disconnectTestDB();
});

describe("getRequestLanguage", () => {
  it("the remembered cookie wins over the browser header", async () => {
    request.cookie = "fr";
    request.acceptLanguage = "de-CH,de;q=0.9";
    expect(await getRequestLanguage()).toBe("fr");
  });

  it("the URL prefix the proxy hands over wins over cookie and header (#58 review)", async () => {
    request.pathPrefix = "it";
    request.cookie = "fr";
    request.acceptLanguage = "de-CH,de;q=0.9";
    expect(await getRequestLanguage()).toBe("it");
  });

  it("a prefix outside the active set falls through to the cookie", async () => {
    request.pathPrefix = "xx";
    request.cookie = "fr";
    expect(await getRequestLanguage()).toBe("fr");
  });

  it("falls back to Accept-Language with q-values", async () => {
    request.acceptLanguage = "de;q=0.8, it;q=0.9";
    expect(await getRequestLanguage()).toBe("it");
  });

  it("ignores values outside the active set and falls through", async () => {
    request.cookie = "xx";
    request.acceptLanguage = "nl, fr;q=0.5";
    expect(await getRequestLanguage()).toBe("fr");
  });

  it("answers the first active language when nothing is known", async () => {
    expect(await getRequestLanguage()).toBe("de");
  });

  it("never answers a deactivated language, even from the cookie", async () => {
    await seedLanguages();
    await LanguageModel.updateMany({}, { $set: { active: false } });
    await LanguageModel.updateOne({ code: "es" }, { $set: { active: true, position: 0 } });
    invalidateI18nCache();
    request.cookie = "de";
    expect(await getRequestLanguage()).toBe("es");
    await clearCollections();
    invalidateI18nCache();
  });

  it("outside a request scope (tests, scripts) the first active language answers", async () => {
    request.outsideRequest = true;
    expect(await getRequestLanguage()).toBe("de");
  });
});

// #58 admin formats slice: the admin's amounts, dates and weights follow the request
// language's row too — getRequestFormatters is the single server-side entry. The
// expected renderings are computed from the locale in the test, so no ICU vocabulary
// is pinned.
describe("getRequestFormatters", () => {
  it("the cookie's language picks the formatter set", async () => {
    request.cookie = "fr";
    const f = await getRequestFormatters();
    const fr = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });
    const de = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
    const frDate = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long" });
    expect(f.chf(12345)).toBe(fr.format(123.45));
    expect(f.chf(12345)).not.toBe(de.format(123.45));
    const date = new Date(Date.UTC(2026, 6, 15));
    expect(f.date(date)).toBe(frDate.format(date));
  });

  it("the set is cached — the same locale answers with the same object", async () => {
    request.cookie = "fr";
    expect(await getRequestFormatters()).toBe(await getRequestFormatters());
    expect(await getRequestFormatters()).toBe(
      createFormatters(await getIntlLocale("fr")),
    );
  });

  it("outside a request scope the base language's set answers", async () => {
    request.outsideRequest = true;
    expect(await getRequestFormatters()).toBe(
      createFormatters(intlLocaleOf(DEFAULT_LANGUAGES, BASE_LANGUAGE)),
    );
  });
});

// #58 review: the {amount} of a discount refusal is formatted with the request
// language's Intl locale, not the base locale — a French refusal never carries a
// German-formatted CHF. Both expected amounts are computed in the test from the
// locale, so no ICU vocabulary is pinned.
describe("discount refusals format {amount} per request locale", () => {
  it("the French minOrder refusal carries the fr-CH-formatted amount", async () => {
    await createDiscountCore({
      code: "LOCALE1",
      kind: "percent",
      percent: 10,
      minOrderCents: 12_345,
      perCustomerOnce: false,
    });
    request.cookie = "fr";
    const check = await checkDiscountCore("LOCALE1", 10_000, undefined);
    expect(check.ok).toBe(false);
    const amount = 123.45;
    const fr = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });
    const de = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
    expect(check.error).toContain(fr.format(amount));
    expect(check.error).not.toContain(de.format(amount));
    expect(check.error).toContain("panier");
    await clearCollections();
  });

  it("without a request scope the base locale formats the amount", async () => {
    await createDiscountCore({
      code: "LOCALE2",
      kind: "percent",
      percent: 10,
      minOrderCents: 12_345,
      perCustomerOnce: false,
    });
    request.outsideRequest = true;
    const check = await checkDiscountCore("LOCALE2", 10_000, undefined);
    expect(check.ok).toBe(false);
    const de = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });
    expect(check.error).toContain(de.format(123.45));
    await clearCollections();
  });
});
