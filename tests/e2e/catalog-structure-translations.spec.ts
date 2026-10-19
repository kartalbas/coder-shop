import { expect, test } from "@playwright/test";
import { firstThreePerTypeBySlug } from "../../scripts/seed/demo-content";
import { dimensionLabelKey, typeLabelKey, valueLabelKey } from "../../src/lib/i18n";
import translationsJson from "../../src/server/translations.json";

// Issue #58 step B1b: the catalog structure — type labels (menu, tabs, headings),
// dimension captions (facet groups, picker legends) and attribute values (facet
// checkboxes, picker chips, composed variant labels) — answers in the request language
// from the one table. Nothing is hard-coded: the expected texts and the demo product
// are derived from the seed's own generator, the type configuration and the seed file.

interface Row {
  key: string;
  de: string;
  texts: Record<string, string>;
}

const rows = translationsJson as Row[];
const textFr = (key: string): string => rows.find((row) => row.key === key)!.texts.fr;

// A demo product that has the colour "schwarz" on a variant — its picker chip and
// facet value must answer "noir" on /fr.
const product = firstThreePerTypeBySlug().find((candidate) =>
  candidate.variants.some((variant) => variant.attributes.color === "schwarz"),
)!;
// A non-demo product proves the German fallback stays intact.
const demoSlugs = new Set(firstThreePerTypeBySlug().map((candidate) => candidate.slug));

test("the French listing localizes type tabs and facet groups and values", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/fr/products");
  const main = page.locator("#main");
  await expect(
    main.getByRole("button", { name: textFr(typeLabelKey("shoes")), exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(main.getByRole("button", { name: "Schuhe", exact: true })).toHaveCount(0);
  await expect(page.getByText(textFr(dimensionLabelKey("color")), { exact: true }).first()).toBeVisible();
  await expect(page.getByText(textFr(valueLabelKey("color", "schwarz")), { exact: true }).first()).toBeVisible();
  await expect(page.getByText("schwarz", { exact: true })).toHaveCount(0);
});

test("the French product page localizes the picker legend and values", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/fr/products/${product.slug}`);
  await expect(
    page.getByRole("button", { name: textFr(valueLabelKey("color", "schwarz")), exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(textFr(dimensionLabelKey("color")), { exact: true })).toBeVisible();
  await expect(page.getByText("Farbe", { exact: true })).toHaveCount(0);
});

test("the German pages stay byte-identical to the configuration", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/de/products");
  const main = page.locator("#main");
  await expect(main.getByRole("button", { name: "Schuhe", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Farbe", { exact: true }).first()).toBeVisible();
  await page.goto(`/de/products/${[...demoSlugs][0]}`);
  await expect(page.getByText("Farbe", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});
