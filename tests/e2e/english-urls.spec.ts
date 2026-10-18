import { expect, test } from "@playwright/test";

// Issue #63: routes and public URLs are English; the former German URLs answer a
// permanent redirect (308) to their exact English counterpart. The mapping lives in
// next.config.ts redirects() — this spec proves every old URL still lands correctly.

const MOVED: [string, string][] = [
  ["/produkte", "/products"],
  ["/produkte/vergleichen?slugs=a,b", "/products/compare?slugs=a,b"],
  ["/produkt/gibts-nicht", "/products/gibts-nicht"],
  ["/warenkorb", "/cart"],
  ["/kasse", "/checkout"],
  ["/bestellung/B-2026-000001", "/orders/B-2026-000001"],
  ["/bestellung/B-2026-000001/rechnung", "/orders/B-2026-000001/invoice"],
  ["/konto", "/account"],
  ["/konto/anmelden", "/account/login"],
  ["/konto/registrieren", "/account/register"],
  ["/konto/passwort-vergessen", "/account/forgot-password"],
  ["/konto/passwort-zuruecksetzen", "/account/reset-password"],
  ["/konto/bestellungen", "/account/orders"],
  ["/konto/rechnungen", "/account/invoices"],
  ["/konto/wunschliste", "/account/wishlist"],
  ["/konto/adressen", "/account/addresses"],
  ["/konto/profil", "/account/profile"],
];

test("every former German URL permanently redirects to its English route", async ({
  request,
}) => {
  for (const [german, english] of MOVED) {
    const response = await request.get(german, { maxRedirects: 0, failOnStatusCode: false });
    expect(response.status(), `${german} should be a permanent redirect`).toBe(308);
    // The redirect target keeps the query; Next percent-encodes it, so compare decoded.
    const location = decodeURIComponent(response.headers().location ?? "");
    expect(location, `${german} → ${english}`).toContain(english);
  }
});

// Issue #58: a prefix-free English path is answered with the language redirect (307) to
// its localized URL; behind the prefix the English path is the route itself.
test("the English routes answer behind the language prefix", async ({ request }) => {
  const products = await request.get("/products", { maxRedirects: 0, failOnStatusCode: false });
  expect(products.status(), "/products should redirect to the language root").toBe(307);
  expect(products.headers().location ?? "").toContain("/de/products");
  const localized = await request.get("/de/products", { maxRedirects: 0, failOnStatusCode: false });
  expect(localized.status(), "/de/products should answer directly").toBe(200);
  const account = await request.get("/de/account", { maxRedirects: 0, failOnStatusCode: false });
  // Guests are redirected to the login route — English path, current language prefix.
  expect(account.status()).toBe(307);
  expect(account.headers().location ?? "").toContain("/de/account/login");
});
