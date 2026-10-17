import { NextResponse, type NextRequest } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  SESSION_COOKIE,
  sessionScopeOf,
  verifySessionToken,
} from "@/server/session-token";
import { connectDB } from "@/server/db";
import { ProductModel } from "@/models/product";

// Issue #39: the customer portal is guarded like /admin — signature + expiry only here
// (no DB in the proxy); pages and actions additionally check user existence, role and
// revocation via requireCustomerSession/getCustomerSessionUserId.
const PUBLIC_KONTO_PATHS = new Set([
  "/konto/anmelden",
  "/konto/registrieren",
  "/konto/passwort-vergessen",
  "/konto/passwort-zuruecksetzen",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Issue #28: a PPR page streams its shell before the page code runs, so notFound()
  // there can only ever answer 200. The one indexed slug check happens here instead —
  // before any bytes are sent — and unknown products get a real HTTP 404.
  if (pathname.startsWith("/produkt/")) {
    const slug = decodeURIComponent(pathname.slice("/produkt/".length));
    await connectDB();
    const exists = Boolean(slug) && (await ProductModel.exists({ slug }));
    if (!exists) {
      return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
    }
    return NextResponse.next();
  }

  if (pathname === "/konto" || pathname.startsWith("/konto/")) {
    if (PUBLIC_KONTO_PATHS.has(pathname)) return NextResponse.next();
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (payload && sessionScopeOf(payload) === "customer") return NextResponse.next();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/konto/anmelden";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

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

export const config = {
  matcher: ["/admin/:path*", "/produkt/:path*", "/konto/:path*"],
};
