import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { LANGUAGE_COOKIE } from "@/lib/i18n";
import { LanguageModel } from "@/models/language";
import { invalidateI18nCache } from "@/server/i18n";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #65: the base language (first active language row) answers directly on the
// prefix-free URL — the entry URL never redirects — while every other resolved language
// keeps the 307 to its prefix. The base language is data (the rows), never code.
function requestFor(pathname: string, init?: { cookie?: string; acceptLanguage?: string }) {
  const headers: Record<string, string> = {};
  if (init?.cookie) headers.cookie = init.cookie;
  if (init?.acceptLanguage) headers["accept-language"] = init.acceptLanguage;
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers,
  });
}

describe("proxy language serving (src/proxy.ts, issue #65)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    invalidateI18nCache();
  });

  afterEach(async () => {
    await clearCollections();
    invalidateI18nCache();
  });

  it("answers the prefix-free entry URL directly in the base language", async () => {
    for (const pathname of ["/", "/products"]) {
      const response = await proxy(requestFor(pathname));
      expect(response.status, pathname).toBe(200);
      expect(response.headers.get("x-middleware-rewrite"), pathname).toBe(
        `http://localhost:3000/de${pathname === "/" ? "" : pathname}`,
      );
    }
  });

  it("hands the rewritten request the language and path headers", async () => {
    const response = await proxy(requestFor("/products"));
    const overridden = response.headers.get("x-middleware-override-headers") ?? "";
    expect(overridden).toContain("x-language");
    expect(response.headers.get("x-middleware-request-x-language")).toBe("de");
    expect(response.headers.get("x-middleware-request-x-localized-path")).toBe("/products");
  });

  it("leaves prefixed requests on their own URL", async () => {
    const response = await proxy(requestFor("/fr/products"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("the base language is the first active row, not a hard-coded code", async () => {
    await LanguageModel.create([
      { code: "fr", label: "Français", intlLocale: "fr-CH", position: 0, active: true },
      { code: "de", label: "Deutsch", intlLocale: "de-CH", position: 1, active: true },
    ]);
    invalidateI18nCache();

    const base = await proxy(requestFor("/products"));
    expect(base.status).toBe(200);
    expect(base.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/fr/products");

    const other = await proxy(requestFor("/products", { cookie: `${LANGUAGE_COOKIE}=de` }));
    expect(other.status).toBe(307);
    expect(new URL(other.headers.get("location")!).pathname).toBe("/de/products");
  });
});

afterAll(async () => {
  await disconnectTestDB();
});
