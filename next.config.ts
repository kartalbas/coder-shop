import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
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
    ];
  },
};

export default nextConfig;
