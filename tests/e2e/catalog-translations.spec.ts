import { expect, test, type Page } from "@playwright/test";
import { generateCatalog, type SeedProduct } from "../../scripts/seed/catalog";
import { productContentKeys } from "../../src/lib/i18n";
import translationsJson from "../../src/server/translations.json";

// Issue #58 step B1a: product names and descriptions are rows of the one translation
// table, resolved in the request language. Nothing here is hard-coded — the demo set
// and the expected texts are derived from the seed's own catalog generator and the
// seed file, exactly the data the running server was seeded from.

interface Row {
  key: string;
  de: string;
  texts: Record<string, string>;
}

const rows = translationsJson as Row[];
const rowFor = (key: string): Row => rows.find((row) => row.key === key)!;

function firstThreePerTypeBySlug(): SeedProduct[] {
  const byType = new Map<string, SeedProduct[]>();
  for (const product of generateCatalog()) {
    const list = byType.get(product.type) ?? [];
    list.push(product);
    byType.set(product.type, list);
  }
  return [...byType.values()].flatMap((products) =>
    [...products].sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 3),
  );
}

const demo = firstThreePerTypeBySlug();
const demoSlugs = new Set(demo.map((product) => product.slug));
// A demo product whose French name differs from the German base.
const product = demo.find((candidate) => {
  const row = rowFor(productContentKeys(candidate.slug).name);
  return row.texts.fr !== candidate.name;
})!;
// A catalog product without content rows — it must fall back to the German document.
const unseeded = generateCatalog().find((candidate) => !demoSlugs.has(candidate.slug))!;

async function openDescription(page: Page, trigger: string) {
  await page.getByRole("button", { name: trigger, exact: true }).click();
}

test("French product page answers with the translated name and description", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const keys = productContentKeys(product.slug);
  await page.goto(`/fr/products/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(rowFor(keys.name).texts.fr, {
    timeout: 30_000,
  });
  await openDescription(page, "Description");
  await expect(page.getByText(rowFor(keys.description).texts.fr, { exact: true })).toBeVisible();
  // The German document text is gone, not just hidden behind the French one.
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(product.name);
});

test("German product page stays byte-identical to the stored document", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/de/products/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(product.name, {
    timeout: 30_000,
  });
  await openDescription(page, "Beschreibung");
  await expect(page.getByText(product.description, { exact: true })).toBeVisible();
});

test("an unseeded product falls back to the German name visibly on /fr", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/fr/products/${unseeded.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(unseeded.name, {
    timeout: 30_000,
  });
});
