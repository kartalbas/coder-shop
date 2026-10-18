import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 admin formats slice: the admin's amounts, dates and weights follow the
// intlLocale of the chosen language row, not the base locale. The assertions use the
// two renderings that genuinely differ between de-CH and fr-CH — the CHF position
// (prefix vs suffix) and the month name's case ("Oktober" vs "octobre") — so the spec
// fails on the pre-change build, where the admin answered de-CH in every language.

test("the admin formats amounts and dates in the chosen language", async ({ page }) => {
  test.setTimeout(120_000);

  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible({
    timeout: 30_000,
  });

  try {
    // Dashboard: every CHF carries the French suffix form, none the German prefix.
    await expect(page.getByText(/CHF$/).first()).toBeVisible();
    await expect(page.getByText(/^CHF\s/)).toHaveCount(0);
    // Recent-order dates carry the French month, never the German one.
    await expect(page.getByText(/octobre/).first()).toBeVisible();
    await expect(page.getByText(/Oktober/)).toHaveCount(0);

    // Orders list: same French formats.
    await page.goto("/admin/orders");
    await expect(page.getByText(/octobre/).first()).toBeVisible();
    await expect(page.getByText(/Oktober/)).toHaveCount(0);
    await expect(page.getByText(/^CHF\s/)).toHaveCount(0);
  } finally {
    // Still on the orders list — the German heading and formats must answer there.
    await page.getByRole("button", { name: /Deutsch/ }).click();
    await expect(page.getByRole("heading", { name: "Bestellungen" })).toBeVisible({
      timeout: 30_000,
    });
    // Back on the base locale the German forms answer again.
    await expect(page.getByText(/^CHF\s/).first()).toBeVisible();
    await expect(page.getByText(/Oktober/).first()).toBeVisible();
  }
});
