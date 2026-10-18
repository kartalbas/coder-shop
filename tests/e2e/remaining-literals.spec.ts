import { expect, test } from "@playwright/test";
import { loginAsAdmin, seedCart } from "./helpers";

// Issue #58 step 3 (last-literals slice): the comparison table, the star-rating aria,
// the site/product metadata and the language switcher read the one translation table.
// Before the change all of this was hard-coded German, so every French assertion here
// fails on the pre-change build.

interface ApiProduct {
  slug: string;
  variants: { stock: number }[];
}

async function stockedSlugs(page: import("@playwright/test").Page, type: string, count: number) {
  const response = await page.request.get(`/api/products?type=${type}`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: ApiProduct[] };
  return body.items
    .filter((item) => item.variants.some((variant) => variant.stock > 0))
    .slice(0, count)
    .map((item) => item.slug);
}

test("the French comparison table speaks French", async ({ page }) => {
  const slugs = await stockedSlugs(page, "smartphone", 3);
  expect(slugs.length).toBeGreaterThanOrEqual(2);
  await page.goto(`/fr/products/compare?slugs=${encodeURIComponent(slugs.join(","))}`);
  for (const row of ["Prix", "Marque", "Poids", "Variantes", "Disponibilité"]) {
    await expect(page.getByRole("rowheader").filter({ hasText: row }).first()).toBeVisible({
      timeout: 30_000,
    });
  }
  // No German row label survives; the stock value follows the French plural family.
  await expect(page.getByRole("rowheader").filter({ hasText: "Preis" })).toHaveCount(0);
  await expect(page.getByRole("rowheader").filter({ hasText: "Verfügbar" })).toHaveCount(0);
  await expect(page.getByRole("cell").filter({ hasText: /^\d+ pièces?$/ }).first()).toBeVisible();
});

test("the French product page ships French metadata and a French switcher", async ({ page }) => {
  const [slug] = await stockedSlugs(page, "smartphone", 1);
  await page.goto(`/fr/products/${slug}`);
  // The per-language description row and the localized site title (Open Graph) —
  // both were static German before the change.
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Prix en CHF/);
  await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
    "content",
    /Preise in CHF/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "coder-shop — Smartphones, chaussures et vêtements",
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /Boutique en ligne premium/,
  );
  // The switcher's own aria label is a row too.
  await expect(page.getByRole("navigation", { name: "Langue" })).toBeVisible();
});

test("the published rating reads its stars in French", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const email = "etoiles.francaise@example.ch";

  await page.goto("/fr/account/register");
  await page.fill("#name", "Critique Française");
  await page.fill("#email", email);
  await page.fill("#password", "Etoiles12345");
  await page.getByRole("checkbox", { name: /CGV/ }).check();
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // Buy the hermetic cart line and remember which product it was.
  await seedCart(page, "/fr/products");
  await page.goto("/fr/checkout");
  await expect(page.getByRole("button", { name: /Acheter maintenant/ })).toBeVisible({
    timeout: 30_000,
  });
  const slug: string = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cart:v1") ?? '{"lines":[]}').lines[0]?.slug ?? "",
  );
  expect(slug).not.toBe("");
  await page.fill("#phone", "079 555 00 02");
  await page.fill("#street", "Rue des Étoiles 3");
  await page.fill("#postalCode", "1201");
  await page.fill("#city", "Genève");
  await page.getByRole("button", { name: /Acheter maintenant/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });

  // The buyer rates in French (the form's star radios already were rows).
  await page.goto(`/fr/products/${slug}`);
  const form = page.getByRole("form", { name: "Noter le produit" });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.locator("label:has(input[aria-label='5 sur 5 étoiles'])").click();
  await form.getByRole("textbox", { name: "Votre note" }).fill(
    "Excellent produit, je recommande vivement.",
  );
  await form.getByRole("button", { name: "Envoyer l'avis" }).click();
  await expect(page.getByRole("status").filter({ hasText: "publié prochainement" })).toBeVisible({
    timeout: 30_000,
  });

  // Publish it as the admin.
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/admin/reviews?status=pending");
  const queueRow = adminPage.getByRole("listitem").filter({ hasText: "Excellent produit" });
  await expect(queueRow).toBeVisible({ timeout: 30_000 });
  await queueRow.getByRole("button", { name: "Freigeben" }).click();
  await expect(queueRow).toBeHidden({ timeout: 30_000 });
  await admin.close();

  // The published average now reads its stars in French — the StarRating aria was the
  // last hard-coded German text on this page.
  await page.goto(`/fr/products/${slug}`);
  await expect(page.locator('[aria-label="5 sur 5 étoiles"]').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[aria-label*="Sternen"]')).toHaveCount(0);
});
