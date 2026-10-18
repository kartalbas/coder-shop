import { expect, test } from "@playwright/test";

// Issue #58 step 2b — numbers, CHF and dates follow the language row's intlLocale.
// The same product card in two languages must show the same amount written the way
// each language writes it: German puts „CHF" in front ("CHF 1'234.50"), French and
// Spanish behind ("1'234.50 CHF", "1234,50 CHF"). Fails on the pre-change build,
// where every locale rendered the de-CH format.

const priceOfFirstCard = (page: import("@playwright/test").Page) =>
  page.locator('main a[href^="/products/"] p.font-semibold').first();

test("the listing shows prices in the request language's CHF style", async ({ page }) => {
  await page.goto("/de/products");
  const de = (await priceOfFirstCard(page).textContent())!;
  expect(de.trim(), `de-CH puts CHF in front: ${de}`).toMatch(/CHF\s?\d/);

  await page.goto("/fr/products");
  const fr = (await priceOfFirstCard(page).textContent())!;
  expect(fr.trim(), `fr-CH puts CHF behind: ${fr}`).toMatch(/\d\s?CHF$/);

  await page.goto("/es/products");
  const es = (await priceOfFirstCard(page).textContent())!;
  expect(es.trim(), `es puts CHF behind: ${es}`).toMatch(/\d\s?CHF$/);
});

test("the same product shows the same amount in every language", async ({ page }) => {
  await page.goto("/de/products");
  const firstCard = page.locator('main a[href^="/products/"]').first();
  const href = await firstCard.getAttribute("href");
  const de = (await priceOfFirstCard(page).textContent())!;

  await page.goto("/fr/products");
  await expect(page.locator('main a[href^="/products/"]').first()).toHaveAttribute("href", href!);
  const fr = (await priceOfFirstCard(page).textContent())!;

  const digits = (value: string) => value.replace(/\D/g, "");
  expect(digits(fr)).toBe(digits(de));
  expect(fr).not.toBe(de);
});
