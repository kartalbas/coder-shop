import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/session-token";
import { connectDB } from "@/server/db";
import { ProductModel } from "@/models/product";

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

  if (pathname === "/admin/login") return NextResponse.next();

  // Fast pre-render gate: signature + expiry only (no DB in the proxy). Revoked sessions
  // (logout/password change, issue #6) pass here but are rejected by every page/action via
  // `requireAdminSession`/`getSessionUserId`, which also check user existence and revocation.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && verifySessionToken(token)) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/produkt/:path*"],
};
