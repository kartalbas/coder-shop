import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("admin navigation on tablet width (issue #21)", () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test("menu button opens a sheet with all sections and logout", async ({ page }) => {
    await loginAsAdmin(page);

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeHidden();

    await page.getByRole("button", { name: "Navigation öffnen" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    for (const label of [
      "Dashboard",
      "Produkte",
      "Bestellungen",
      "Kommissionierung",
      "Einkauf",
      "Lieferanten",
    ]) {
      await expect(sheet.getByRole("link", { name: label })).toBeVisible();
    }

    await sheet.getByRole("link", { name: "Bestellungen" }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: "Navigation öffnen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
