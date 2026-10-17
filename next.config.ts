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
  // Issue #63: routes and public URLs are English; German was only the base language of
  // content. The former German URLs redirect permanently (308) to their English
  // counterparts — the mapping lives here as configuration, not in code paths.
  async redirects() {
    return [
      { source: "/produkte", destination: "/products", permanent: true },
      // Smartphone comparison (issue #48) — before the generic product-slug rule.
      { source: "/produkte/vergleichen", destination: "/products/compare", permanent: true },
      { source: "/produkt/:slug", destination: "/products/:slug", permanent: true },
      { source: "/warenkorb", destination: "/cart", permanent: true },
      { source: "/kasse", destination: "/checkout", permanent: true },
      // Invoice PDF behind the confirmation page (issue #40) — before the plain rule.
      {
        source: "/bestellung/:number/rechnung",
        destination: "/orders/:number/invoice",
        permanent: true,
      },
      { source: "/bestellung/:number", destination: "/orders/:number", permanent: true },
      { source: "/konto", destination: "/account", permanent: true },
      { source: "/konto/anmelden", destination: "/account/login", permanent: true },
      { source: "/konto/registrieren", destination: "/account/register", permanent: true },
      {
        source: "/konto/passwort-vergessen",
        destination: "/account/forgot-password",
        permanent: true,
      },
      {
        source: "/konto/passwort-zuruecksetzen",
        destination: "/account/reset-password",
        permanent: true,
      },
      { source: "/konto/bestellungen", destination: "/account/orders", permanent: true },
      { source: "/konto/rechnungen", destination: "/account/invoices", permanent: true },
      { source: "/konto/wunschliste", destination: "/account/wishlist", permanent: true },
      { source: "/konto/adressen", destination: "/account/addresses", permanent: true },
      { source: "/konto/profil", destination: "/account/profile", permanent: true },
    ];
  },
};

export default nextConfig;
