import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #64: VAT rate, shipping prices and the catalog types are configuration —
// editing them in the admin changes the shop without a code change. The specs share
// one server, so every edit is restored at the end.

async function addOneProductToCart(page: Page): Promise<void> {
  const response = await page.request.get("/api/products?type=smartphone&sort=price-asc");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: { slug: string; variants: unknown[] }[] };
  const product = body.items.find((item) => item.variants.length > 0);
  expect(product).toBeDefined();
  await page.goto(`/produkt/${product!.slug}`);
  for (const group of ["Farbe", "Grösse", "Speicher", "Material"]) {
    const buttons = page.getByRole("group", { name: group }).locator("button");
    if ((await buttons.count()) > 0) await buttons.first().click();
  }
  await page.getByRole("button", { name: "In den Warenkorb" }).click();
}

async function saveSettings(page: Page, vat: string, standardPrice: string): Promise<void> {
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await page.fill("#vatRate", vat);
  await page.getByLabel("Versand-Preis 1").fill(standardPrice);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Konfiguration gespeichert")).toBeVisible();
}

test("admin edits VAT rate and a shipping price — the storefront follows (issue #64)", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  try {
    await saveSettings(page, "7,7", "5.50");

    // Footer copy of every storefront page carries the configured VAT wording.
    await page.goto("/produkte");
    await expect(page.getByText(/inklusive 7,7 % MwSt/).first()).toBeVisible();

    // Cart summary: the edited standard price. formatChf renders a no-break space
    // between "CHF" and the amount, so the regexes match any whitespace there.
    await addOneProductToCart(page);
    await page.goto("/warenkorb");
    await expect(page.getByText(/Standard CHF\s5\.50/).first()).toBeVisible();
    await expect(page.getByText(/7,7 % MwSt/).first()).toBeVisible();
  } finally {
    // Restore the seed values — the other specs share this server, even if this
    // spec failed midway.
    await saveSettings(page, "8,1", "4.90");
  }
  // /api/shop-settings is cached for a minute; enabling routing disables the
  // browser's HTTP cache (Playwright), so this really refetches the restored price.
  await page.route("/api/shop-settings", (route) => route.continue());
  await page.goto("/warenkorb");
  await expect(page.getByText(/Standard CHF\s4\.90/).first()).toBeVisible();
});

test("admin renames a catalog type — the mega-menu follows (issue #64)", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  const rename = async (label: string) => {
    await page.goto("/admin/catalog-types");
    await expect(page.getByRole("heading", { name: "Katalogtypen" })).toBeVisible();
    await page.getByRole("link", { name: "Bearbeiten" }).first().click();
    await expect(page.getByRole("heading", { name: /Katalogtyp bearbeiten/ })).toBeVisible();
    await page.fill("#typeLabel", label);
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Katalogtyp gespeichert")).toBeVisible();
  };

  try {
    await rename("Handys");
    await page.goto("/produkte");
    await expect(page.getByText("Handys").first()).toBeVisible({ timeout: 30_000 });
  } finally {
    await rename("Smartphones").catch(() => undefined);
  }
  await page.goto("/produkte");
  await expect(page.getByText("Smartphones").first()).toBeVisible({ timeout: 30_000 });
});
