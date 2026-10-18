import { describe, expect, it } from "vitest";
import { localizedPath, splitLanguagePrefix } from "./locale-path";

// Issue #58 step 2: the proxy, the switcher and the hreflang links all derive their URLs
// from these two pure functions — the language codes are always passed in as data.
const CODES = ["de", "fr", "it", "rm", "es"];

describe("splitLanguagePrefix", () => {
  it("splits a prefixed path into language and English path", () => {
    expect(splitLanguagePrefix("/de/products", CODES)).toEqual({ lang: "de", rest: "/products" });
    expect(splitLanguagePrefix("/fr/account/profile", CODES)).toEqual({
      lang: "fr",
      rest: "/account/profile",
    });
  });

  it("answers no language for a prefix-free path", () => {
    expect(splitLanguagePrefix("/products", CODES)).toEqual({ lang: null, rest: "/products" });
    expect(splitLanguagePrefix("/", CODES)).toEqual({ lang: null, rest: "/" });
  });

  it("treats the language-only URL as the root path behind the prefix", () => {
    expect(splitLanguagePrefix("/de", CODES)).toEqual({ lang: "de", rest: "/" });
    expect(splitLanguagePrefix("/es/", CODES)).toEqual({ lang: "es", rest: "/" });
  });

  it("ignores segments that are not active language codes", () => {
    expect(splitLanguagePrefix("/xx/products", CODES)).toEqual({ lang: null, rest: "/xx/products" });
    expect(splitLanguagePrefix("/admin/orders", CODES)).toEqual({ lang: null, rest: "/admin/orders" });
  });

  it("normalizes the case of a valid prefix", () => {
    expect(splitLanguagePrefix("/DE/products", CODES)).toEqual({ lang: "de", rest: "/products" });
  });
});

describe("localizedPath", () => {
  it("prefixes a prefix-free path", () => {
    expect(localizedPath("fr", "/products")).toBe("/fr/products");
    expect(localizedPath("de", "/account/login")).toBe("/de/account/login");
  });

  it("maps the root to the bare language segment", () => {
    expect(localizedPath("de", "/")).toBe("/de");
  });
});
