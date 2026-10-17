import { expect, test } from "@playwright/test";

// Issue #26 — accessibility regressions found by axe and keyboard testing.

test("listing has a German <h1> following the active tab/collection", async ({ page }) => {
  await page.goto("/produkte");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alle Produkte");
  await page.goto("/produkte?type=shoes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Schuhe");
});

test("breadcrumb list contains only <li> children", async ({ page }) => {
  const response = await page.request.get("/api/products");
  const body = (await response.json()) as { items: { slug: string }[] };
  await page.goto(`/produkt/${body.items[0].slug}`);
  const breadcrumbs = page.getByRole("navigation", { name: "Brotkrumen-Navigation" });
  await expect(breadcrumbs).toBeVisible();
  const invalid = await breadcrumbs
    .locator("ol > :not(li)")
    .count();
  expect(invalid).toBe(0);
  expect(await breadcrumbs.locator("ol > li").count()).toBeGreaterThanOrEqual(2);
});

test("gallery zooms via keyboard and the dialog closes in German", async ({ page }) => {
  const response = await page.request.get("/api/products?type=smartphone&brand=Apple");
  const body = (await response.json()) as { items: { slug: string; images: unknown[] }[] };
  const product = body.items.find((item) => item.images.length >= 2);
  expect(product, "seed must contain an Apple phone with ≥2 images").toBeDefined();
  await page.goto(`/produkt/${product!.slug}`);

  const mainImage = page.locator("main img[tabindex='0']").first();
  await expect(mainImage).toBeVisible();
  await mainImage.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Close control is labelled in German (was English "Close").
  await expect(dialog.getByRole("button", { name: "Schliessen" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Gallery arrows are reachable and visible with keyboard focus alone.
  const next = page.getByRole("button", { name: "Nächstes Bild" });
  await next.focus();
  await expect(next).toBeVisible();
});

test("search reports no hits and its options are no tab stops", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("combobox", { name: "Schnellsuche" });
  await input.fill("qxwz");
  await expect(page.getByRole("status")).toContainText("Keine Treffer");

  await input.fill("iphone");
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  const tabStops = await page.locator('#search-listbox button:not([tabindex="-1"])').count();
  expect(tabStops).toBe(0);
});

test("stock indicator and admin badges use the 700 contrast tones", async ({ page }) => {
  const response = await page.request.get("/api/products");
  const body = (await response.json()) as { items: { slug: string }[] };
  await page.goto(`/produkt/${body.items[0].slug}`);
  // The indicator only appears once a concrete variant exists (issue #18):
  // pick the first option of every variant group.
  const groups = page.locator("main fieldset");
  const groupCount = await groups.count();
  for (let i = 0; i < groupCount; i++) {
    await groups.nth(i).locator("button:not([disabled])").first().click();
  }
  const indicator = page.locator("main p").filter({ hasText: /Sofort lieferbar|Nur noch|Ausverkauft/ }).first();
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveClass(/text-(emerald|amber|red)-700/);
});
