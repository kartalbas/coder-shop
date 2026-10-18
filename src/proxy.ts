import { NextResponse, type NextRequest } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  SESSION_COOKIE,
  sessionScopeOf,
  verifySessionToken,
} from "@/server/session-token";
import { connectDB } from "@/server/db";
import { ProductModel } from "@/models/product";
import { LANGUAGE_COOKIE, resolveLanguage } from "@/lib/i18n";
import {
  LANGUAGE_HEADER,
  LOCALIZED_PATH_HEADER,
  localizedPath,
  splitLanguagePrefix,
} from "@/lib/locale-path";
import { getActiveLanguages } from "@/server/i18n";

// Issue #39: the customer portal is guarded like /admin — signature + expiry only here
// (no DB in the proxy); pages and actions additionally check user existence, role and
// revocation via requireCustomerSession/getCustomerSessionUserId. Paths are checked
// behind the language prefix (#58), the redirect target gets the prefix back.
const PUBLIC_ACCOUNT_PATHS = new Set([
  "/account/login",
  "/account/register",
  "/account/forgot-password",
  "/account/reset-password",
]);

// Public files (generated product photos under /products/…, favicon) are served by the
// filesystem after the proxy — they are never storefront routes and must never be
// redirected or slug-checked (#63 made photos and product pages share the /products/
// prefix).
function isPublicFile(pathname: string): boolean {
  return pathname.split("/").pop()!.includes(".");
}

// The remembered-choice cookie is refreshed on document navigations only. Background
// RSC prefetches of the page's links run through this proxy prefixed as well, and their
// responses can land after a newer navigation finished — a stale `/de/…` prefetch
// response would then overwrite the language the user has just switched to (the e2e
// switcher flake). Only `Accept: text/html` requests write the cookie.
function isDocumentNavigation(request: NextRequest): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

function adminGate(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  // Fast pre-render gate: signature + expiry only (no DB in the proxy). Revoked sessions
  // (logout/password change, issue #6) pass here but are rejected by every page/action via
  // `requireAdminSession`/`getSessionUserId`, which also check user existence and revocation.
  // A customer-scope token never passes the admin gate (issue #39).
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? verifySessionToken(token) : null;
  if (payload && sessionScopeOf(payload) === "admin") return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The internal `/_not-found` route (every unmatched URL, and the target of the
  // slug-404 rewrite below) has no language prefix — running the language logic on it
  // would answer the 404 with a redirect to /de/_not-found (visible URL, base
  // language). It passes through untouched; the x-language header the rewrite
  // attaches flows on to the page, which resolves the language itself (#58 review).
  if (pathname === "/_not-found") return NextResponse.next();

  if (isPublicFile(pathname)) return NextResponse.next();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(request);

  // Issue #58 step 2: the language is the first URL segment. A prefix-free storefront
  // path resolves the language (cookie > browser > first active row): the base language
  // answers directly on the prefix-free URL (#65 — the entry URL never redirects), every
  // other language is redirected to its localized URL (query preserved). A prefixed
  // request refreshes the remembered-choice cookie and its gates run on the stripped path.
  const languages = await getActiveLanguages();
  const codes = languages.map((language) => language.code);
  const split = splitLanguagePrefix(pathname, codes);
  let lang = split.lang;
  let rest = split.rest;
  // True while a prefix-free request is served in the base language via an internal
  // rewrite — the response then has to carry the request into that rewrite.
  let prefixFreeBase = false;

  if (!lang) {
    const target = resolveLanguage({
      cookie: request.cookies.get(LANGUAGE_COOKIE)?.value,
      acceptLanguage: request.headers.get("accept-language"),
      languages,
    });
    if (target !== codes[0]) {
      const url = request.nextUrl.clone();
      url.pathname = localizedPath(target, pathname);
      return NextResponse.redirect(url);
    }
    lang = target;
    rest = pathname;
    prefixFreeBase = true;
  }

  // Issue #28: a PPR page streams its shell before the page code runs, so notFound()
  // there can only ever answer 200. The one indexed slug check happens here instead —
  // before any bytes are sent — and unknown products get a real HTTP 404. The listing
  // and the comparison page are routes, not slugs (#63 made /products public).
  if (rest !== "/products" && rest !== "/products/compare" && rest.startsWith("/products/")) {
    const slug = decodeURIComponent(rest.slice("/products/".length));
    await connectDB();
    const exists = Boolean(slug) && (await ProductModel.exists({ slug }));
    if (!exists) {
      // The rewritten global `/_not-found` renders the 404 in the prefix language —
      // the header is the only channel to a route outside the `[lang]` tree.
      const notFoundHeaders = new Headers(request.headers);
      notFoundHeaders.set(LANGUAGE_HEADER, lang);
      return NextResponse.rewrite(new URL("/_not-found", request.url), {
        status: 404,
        request: { headers: notFoundHeaders },
      });
    }
  }

  if (rest === "/account" || rest.startsWith("/account/")) {
    if (!PUBLIC_ACCOUNT_PATHS.has(rest)) {
      const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
      const payload = token ? verifySessionToken(token) : null;
      if (!payload || sessionScopeOf(payload) !== "customer") {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = localizedPath(lang, "/account/login");
        loginUrl.search = "";
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // The `[lang]` layout's generateMetadata needs the current path for its hreflang
  // alternates — metadata cannot see the request URL without opting out of prerendering,
  // so the proxy hands it over as a request header (the documented proxy→app channel).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALIZED_PATH_HEADER, rest);
  // The prefix language for code outside the `[lang]` tree (the global `/_not-found`
  // behind the slug-404 rewrite above) — the URL prefix wins over cookie and header
  // there too, the same precedence as here.
  requestHeaders.set(LANGUAGE_HEADER, lang);
  // A prefix-free base-language request never leaves the browser with a redirect (#65):
  // it is rewritten internally to the `[lang]` route and answers 200 on its own URL.
  const response = prefixFreeBase
    ? NextResponse.rewrite(
        new URL(localizedPath(lang, pathname) + request.nextUrl.search, request.url),
        { request: { headers: requestHeaders } },
      )
    : NextResponse.next({ request: { headers: requestHeaders } });
  if (isDocumentNavigation(request)) {
    response.cookies.set(LANGUAGE_COOKIE, lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except the Next internals, the JSON API and files with an extension
    // (public photos/favicon) — storefront paths need the language, /admin needs its gate.
    "/((?!_next/|api/|.*\\.).*)",
  ],
};
