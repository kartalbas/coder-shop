import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Issue #25: generated product photos change essentially never (a re-run of
        // `npm run images` overwrites a slot) — cache them for a day and revalidate
        // in the background instead of `max-age=0` on every view.
        source: "/products/:base.:ext(webp|jpe?g|png|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing on this site may be framed (clickjacking on the admin especially).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" },
          // Ignored by browsers over http, enforced over https.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/produkte", destination: "/products" },
      { source: "/produkt/:slug", destination: "/products/:slug" },
      { source: "/warenkorb", destination: "/cart" },
      { source: "/kasse", destination: "/checkout" },
      { source: "/bestellung/:number", destination: "/order/:number" },
      // Invoice PDF behind the confirmation page (issue #40).
      { source: "/bestellung/:number/rechnung", destination: "/order/:number/rechnung" },
    ];
  },
};

export default nextConfig;
