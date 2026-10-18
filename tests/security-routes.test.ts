import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";
import { ProductModel } from "@/models/product";
import { UserModel } from "@/models/user";
import { SESSION_COOKIE, createSessionToken } from "@/server/session-token";
import { resolveInsideDir } from "@/server/secure-path";
import { LABELS_DIR } from "@/server/shipping/label";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

describe("admin proxy guard (src/proxy.ts)", () => {
  function requestFor(pathname: string, cookie?: string): NextRequest {
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = cookie;
    return new NextRequest(`http://localhost:3000${pathname}`, { headers });
  }

  it("lets the login page through without a session", async () => {
    const response = await proxy(requestFor("/admin/login"));
    expect(response.status).toBe(200);
  });

  it("redirects every other admin path to the login when there is no cookie", async () => {
    for (const pathname of ["/admin", "/admin/orders", "/admin/products/123"]) {
      const response = await proxy(requestFor(pathname));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
    }
  });

  it("redirects on a forged or malformed cookie", async () => {
    const forged = `${Buffer.from(JSON.stringify({ userId: "admin", exp: Date.now() + 60_000 })).toString("base64url")}.${"A".repeat(43)}`;
    for (const token of [forged, "not-a-token", ""]) {
      const response = await proxy(requestFor("/admin/orders", `${SESSION_COOKIE}=${token}`));
      expect(response.status).toBe(307);
    }
  });

  it("lets a validly signed session through", async () => {
    const token = createSessionToken("user-1");
    const response = await proxy(requestFor("/admin/orders", `${SESSION_COOKIE}=${token}`));
    expect(response.status).toBe(200);
  });
});

describe("product slug guard (src/proxy.ts, issue #28)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await ProductModel.create({
      _id: new Types.ObjectId(),
      slug: "bekanntes-produkt",
      name: "Bekanntes Produkt",
      brand: "Acme",
      type: "shoes",
      description: "d",
      priceCents: 1000,
      images: [],
      variants: [],
      filter: {  color: [], size: [], storage: [""], material: []  },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  function productRequest(slug: string): NextRequest {
    return new NextRequest(`http://localhost:3000/de/products/${slug}`);
  }

  it("answers a real 404 for an unknown slug", async () => {
    const response = await proxy(productRequest("gibts-nicht"));
    expect(response.status).toBe(404);
  });

  it("lets a known slug through", async () => {
    const response = await proxy(productRequest("bekanntes-produkt"));
    expect(response.status).toBe(200);
  });

  // Issue #63: /products is public now — the listing and the comparison page are
  // routes, not slugs, and must never fall into the admin gate.
  for (const pathname of ["/de/products", "/de/products/compare"]) {
    it(`lets the public route ${pathname} through without a session`, async () => {
      const response = await proxy(new NextRequest(`http://localhost:3000${pathname}`));
      expect(response.status).toBe(200);
    });
  }

  // #63 gave photos and product pages the same /products/ prefix — a photo must never
  // fall into the slug check (it would answer 404 for a file that exists).
  it("serves a product photo without the slug check", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/products/bekanntes-produkt-1.webp"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("language routing (src/proxy.ts, issue #58)", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  function requestFor(pathname: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`http://localhost:3000${pathname}`, { headers });
  }

  it("redirects a prefix-free path to the default language, query preserved", async () => {
    const response = await proxy(requestFor("/products?type=shoes&size=42"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/de/products");
    expect(location.search).toBe("?type=shoes&size=42");
  });

  it("uses Accept-Language when nothing is remembered", async () => {
    const response = await proxy(requestFor("/products", { "accept-language": "fr-CH,fr;q=0.9" }));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/fr/products");
  });

  it("prefers the remembered cookie over the browser header", async () => {
    const response = await proxy(
      requestFor("/products", { "accept-language": "fr", cookie: "lang=it" }),
    );
    expect(new URL(response.headers.get("location")!).pathname).toBe("/it/products");
  });

  it("redirects an unknown first segment into the resolved language", async () => {
    const response = await proxy(requestFor("/xx/products"));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/de/xx/products");
  });

  it("remembers the language of a prefixed document navigation in the cookie", async () => {
    const response = await proxy(requestFor("/fr/products", { accept: "text/html,*/*" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("lang=fr");
  });

  // The switcher flake: background RSC prefetches of the page's links also arrive
  // prefixed; their late responses must not overwrite a language the user has just
  // switched to, so only document navigations write the cookie.
  it("does not touch the cookie on a background RSC prefetch", async () => {
    const response = await proxy(
      requestFor("/de/products/bekanntes-produkt?_rsc=abc", { accept: "text/x-component" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps the admin prefix-free and gated", async () => {
    const response = await proxy(requestFor("/admin/orders"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("gates the account portal behind the language prefix", async () => {
    const response = await proxy(requestFor("/de/account/orders"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/de/account/login");
    const login = await proxy(requestFor("/de/account/login"));
    expect(login.status).toBe(200);
  });

  // The proxy function itself never sees matcher-excluded paths — the matcher is the
  // only guard for the JSON API and Next internals, so it is asserted here.
  it("matcher excludes the API, Next internals and files with extensions", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    for (const path of [
      "/api/health",
      "/api/products",
      "/_next/static/chunks/a.js",
      "/_next/image?url=%2Fx.webp",
      "/products/bekanntes-produkt-1.webp",
      "/favicon.ico",
    ]) {
      expect(pattern.test(path), path).toBe(false);
    }
    for (const path of ["/", "/products", "/de/products", "/fr/account/profile", "/admin"]) {
      expect(pattern.test(path), path).toBe(true);
    }
  });
});

describe("label path containment (label download route)", () => {
  it("accepts a file inside the labels directory", () => {
    const file = resolveInsideDir(LABELS_DIR, "data/labels/B-2026-000001.pdf");
    expect(file).toContain("B-2026-000001.pdf");
  });

  it("refuses traversal out of the labels directory", () => {
    expect(resolveInsideDir(LABELS_DIR, "data/labels/../../.env")).toBeNull();
    expect(resolveInsideDir(LABELS_DIR, "/etc/passwd")).toBeNull();
    expect(resolveInsideDir(LABELS_DIR, "data/labels-evil/x.pdf")).toBeNull();
  });

  it("refuses the directory itself and empty paths", () => {
    expect(resolveInsideDir(LABELS_DIR, "data/labels")).toBeNull();
    expect(resolveInsideDir(LABELS_DIR, "")).toBeNull();
  });
});

const { cookieJar } = vi.hoisted(() => ({
  cookieJar: {} as Record<string, string | undefined>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar[name] ? { name, value: cookieJar[name] } : undefined,
  }),
}));

describe("session guards against the database", () => {
  let userId: string;

  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    const user = await UserModel.create({
      email: "guard@codershop.ch",
      name: "Guard",
      passwordHash: "scrypt$2$8$1$" + "0".repeat(32) + "$" + "0".repeat(64),
      role: "admin",
    });
    userId = user._id.toString();
  });

  afterAll(async () => {
    delete cookieJar[SESSION_COOKIE];
    await disconnectTestDB();
  });

  it("getSessionUserId accepts a valid token of an existing user", async () => {
    cookieJar[SESSION_COOKIE] = createSessionToken(userId);
    const { getSessionUserId } = await import("@/server/session");
    expect(await getSessionUserId()).toBe(userId);
  });

  it("getSessionUserId refuses without a cookie and for a deleted user", async () => {
    delete cookieJar[SESSION_COOKIE];
    const { getSessionUserId } = await import("@/server/session");
    expect(await getSessionUserId()).toBeNull();

    cookieJar[SESSION_COOKIE] = createSessionToken("507f1f77bcf86cd799439011");
    expect(await getSessionUserId()).toBeNull();
    delete cookieJar[SESSION_COOKIE];
  });

  it("requireAdminSession redirects anonymous visitors and returns the user otherwise", async () => {
    const { requireAdminSession } = await import("@/server/session");
    let digest = "";
    try {
      await requireAdminSession();
    } catch (error) {
      digest = String((error as { digest?: string }).digest ?? error);
    }
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/admin/login");
    cookieJar[SESSION_COOKIE] = createSessionToken(userId);
    expect(await requireAdminSession()).toBe(userId);
  });

  it("getAdminEmail answers the e-mail for a real user and null for an unknown id", async () => {
    const { getAdminEmail } = await import("@/server/session");
    expect(await getAdminEmail(userId)).toBe("guard@codershop.ch");
    expect(await getAdminEmail("507f1f77bcf86cd799439011")).toBeNull();
  });
});
