import { expect, test } from "@playwright/test";

// Issue #58 storefront finish — the mega-menu and the comparison page read their texts
// from the translation table in the request language. Both were hard-coded German
// before, so every assertion of a non-German text fails on the pre-change build;
// the German tests prove the byte-identical bases.

async function openFirstCategory(page: import("@playwright/test").Page, navLabel: string) {
  await page.locator(`nav[aria-label="${navLabel}"] button`).first().click();
}

test("the French mega-menu answers in French", async ({ page }) => {
  await page.goto("/fr/products");
  await openFirstCategory(page, "Navigation principale");
  await expect(page.getByText("Marques", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Tous les/ })).toBeVisible();
  await expect(page.getByText("Découvrir maintenant")).toBeVisible();
  await expect(page.getByText("Marken", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Alle / })).toHaveCount(0);
  await expect(page.getByText("Jetzt entdecken")).toHaveCount(0);
});

test("the German mega-menu stays the base language", async ({ page }) => {
  await page.goto("/de/products");
  await openFirstCategory(page, "Hauptnavigation");
  await expect(page.getByText("Marken", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Alle / })).toBeVisible();
  await expect(page.getByText("Jetzt entdecken")).toBeVisible();
});

test("the French comparison page answers in French", async ({ request }) => {
  const response = await request.get("/api/products?type=smartphone");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: { slug: string }[] };
  expect(body.items.length).toBeGreaterThanOrEqual(2);
  const slugs = body.items.slice(0, 2).map((item) => item.slug).join(",");

  const html = await (await request.get(`/fr/products/compare?slugs=${slugs}`)).text();
  expect(html).toContain("Comparer Smartphones</h1>");
  expect(html).toContain("Caractéristique");
  expect(html).toContain("Retour aux Smartphones");
  expect(html).toContain("au maximum");
  expect(html).not.toContain("Merkmal");
  expect(html).not.toContain("(Unterschied)");
  expect(html).not.toContain("von maximal");
  expect(html).not.toContain("Zurück zu den");
});

test("the German comparison page stays the base language", async ({ request }) => {
  const response = await request.get("/api/products?type=smartphone");
  const body = (await response.json()) as { items: { slug: string }[] };
  const slugs = body.items.slice(0, 2).map((item) => item.slug).join(",");

  const html = await (await request.get(`/de/products/compare?slugs=${slugs}`)).text();
  expect(html).toContain("Smartphones vergleichen</h1>");
  expect(html).toContain("Merkmal");
  expect(html).toContain("Zurück zu den Smartphones");
  expect(html).not.toContain(" compare</h1>");
});
