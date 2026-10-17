import { expect, test } from "@playwright/test";

// Issue #53/#61: the filter column is built from the attributes the products of the
// selected category really have — smartphones never offer Grösse/Material, shoes never
// offer Speicher, and a configured facet filters when clicked.

async function facetGroupNames(page: import("@playwright/test").Page): Promise<string[]> {
  const sidebar = page.getByRole("complementary", { name: "Filter" });
  await expect(sidebar).toBeVisible();
  const legends = sidebar.locator("legend");
  const count = await legends.count();
  return Promise.all(
    Array.from({ length: count }, (_, i) => legends.nth(i).innerText()),
  );
}

test("smartphones offer only their own facets", async ({ page }) => {
  await page.goto("/products?type=smartphone");
  const groups = await facetGroupNames(page);
  expect(groups).toEqual(expect.arrayContaining(["Marke", "Farbe", "Speicher"]));
  expect(groups).not.toContain("Grösse");
  expect(groups).not.toContain("Material");
});

test("shoes offer EU size but no storage", async ({ page }) => {
  await page.goto("/products?type=shoes");
  const groups = await facetGroupNames(page);
  expect(groups).toEqual(expect.arrayContaining(["Marke", "Farbe", "Grösse"]));
  expect(groups).not.toContain("Speicher");
});

test("clothing offers size and material but no storage", async ({ page }) => {
  await page.goto("/products?type=clothing");
  const groups = await facetGroupNames(page);
  expect(groups).toEqual(expect.arrayContaining(["Marke", "Farbe", "Grösse", "Material"]));
  expect(groups).not.toContain("Speicher");
});

test("a configured facet filters the listing when clicked", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/products?type=smartphone");
  const sidebar = page.getByRole("complementary", { name: "Filter" });
  const storageGroup = sidebar.locator("fieldset", { has: page.locator("legend", { hasText: "Speicher" }) });
  const firstCheckbox = storageGroup.getByRole("checkbox").first();
  await expect(firstCheckbox).toBeVisible();
  const firstLabel = await storageGroup.locator("label").first().innerText();
  await firstCheckbox.click();
  await expect(page).toHaveURL(/storage=/);
  await expect(page.getByRole("heading", { name: "Smartphones" })).toBeVisible();
  // Every card respects the facet: the API behind the same URL agrees.
  const url = new URL(page.url());
  const response = await page.request.get(`/api/products?${url.searchParams.toString()}`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: { filter: { storage?: string[] } }[] };
  for (const item of body.items) {
    expect(item.filter.storage).toContain(firstLabel.replace(/\s+GB$/, ""));
  }
});
