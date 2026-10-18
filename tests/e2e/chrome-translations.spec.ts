import { expect, test } from "@playwright/test";

// Issue #58 step 3 (slice) — the storefront chrome reads its texts from the
// translation table in the request language. The header and footer of /fr and /es
// answer in French/Spanish; German stays the base. Fails on the pre-change build,
// where both were hard-coded German in every language.

test("the German chrome stays the base language", async ({ request }) => {
  const html = await (await request.get("/de/products")).text();
  expect(html).toContain('aria-label="Mein Konto"');
  expect(html).toContain("Sortiment");
  expect(html).toContain("14 Tage Rückgaberecht");
});

test("the French chrome answers in French", async ({ request }) => {
  const html = await (await request.get("/fr/products")).text();
  expect(html).toContain('aria-label="Mon compte"');
  expect(html).toContain("Assortiment");
  expect(html).toContain("Droit de retour de 14 jours");
  expect(html).toContain("boutique de démonstration");
  expect(html).not.toContain("14 Tage Rückgaberecht");
});

test("the Spanish chrome answers in Spanish", async ({ request }) => {
  const html = await (await request.get("/es/products")).text();
  expect(html).toContain('aria-label="Mi cuenta"');
  expect(html).toContain("Surtido");
  expect(html).toContain("Derecho de devolución de 14 días");
});
