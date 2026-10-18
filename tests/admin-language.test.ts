import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { invalidateI18nCache, saveLanguageCore } from "@/server/i18n";
import { setLanguageAction } from "@/server/actions/admin/language";
import { seedLanguages } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 admin slice: the admin switcher writes the shared `lang` cookie through a
// server action — the same name and options the proxy writes on prefixed storefront
// navigations. Only active language rows are accepted; anything else writes nothing,
// so the language set stays data and a stale or forged code can never stick.

const cookieStore = vi.hoisted(() => ({
  written: undefined as
    | { name: string; value: string; options: Record<string, unknown> }
    | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieStore.written = { name, value, options };
    },
  }),
  headers: async () => ({ get: () => null }),
}));

beforeAll(async () => {
  await connectTestDB();
  await clearCollections();
  invalidateI18nCache();
  await seedLanguages();
});

afterEach(() => {
  cookieStore.written = undefined;
});

afterAll(async () => {
  invalidateI18nCache();
  await disconnectTestDB();
});

describe("setLanguageAction (#58 admin slice)", () => {
  it("writes the shared lang cookie with the proxy's options for an active code", async () => {
    await setLanguageAction("fr");
    expect(cookieStore.written).toEqual({
      name: "lang",
      value: "fr",
      options: { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
    });
  });

  it("refuses an unknown code and writes nothing", async () => {
    await setLanguageAction("xx");
    expect(cookieStore.written).toBeUndefined();
  });

  it("refuses a deactivated language and writes nothing — the active set is data", async () => {
    const deactivated = await saveLanguageCore({
      code: "it",
      label: "Italiano",
      intlLocale: "it-CH",
      position: 2,
      active: false,
    });
    expect(deactivated.ok).toBe(true);
    invalidateI18nCache();
    await setLanguageAction("it");
    expect(cookieStore.written).toBeUndefined();
  });
});
