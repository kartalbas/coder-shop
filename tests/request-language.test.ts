import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { LanguageModel } from "@/models/language";
import { invalidateI18nCache, getRequestLanguage } from "@/server/i18n";
import { seedLanguages } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step 3 (server-messages slice): server actions resolve the request language
// from the `lang` cookie the proxy writes, falling back to Accept-Language and the first
// active row — the same precedence the proxy uses. The mock below plays the request
// scope; without cookie and headers the first active language must answer.

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: undefined as string | undefined,
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
      get: (name: string) =>
        name.toLowerCase() === "accept-language" ? (request.acceptLanguage ?? null) : null,
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
