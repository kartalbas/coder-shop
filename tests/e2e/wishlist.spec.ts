import { expect, test, type Page } from "@playwright/test";

const EMAIL = "wunschliste@example.ch";
const PASSWORD = "WunschListe123";

// Finds a product with at least one sold-out variant through the JSON API and returns
// the attribute values that select exactly that variant.
async function soldOutVariant(page: Page): Promise<{ slug: string; attributes: Record<string, string | number> } | null> {
  for (const type of ["smartphone", "shoes", "clothing"]) {
    const response = await page.request.get(`/api/products?type=${type}`);
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      items: { slug: string; variants: { stock: number; attributes: Record<string, string | number> }[] }[];
    };
    for (const item of body.items) {
      const variant = item.variants.find((v) => v.stock === 0);
      if (variant) return { slug: item.slug, attributes: variant.attributes };
    }
  }
  return null;
}

test("wishlist: heart on cards, rail, account sync across logout/login (issue #46)", async ({
  page,
}) => {
  test.setTimeout(150_000);

  // Guest: put the first listing card on the wishlist. The label matches both states
  // ("… auf die Wunschliste" / "… von der Wunschliste entfernen"), so the locator keeps
  // pointing at the same heart after the toggle.
  await page.goto("/produkte?type=shoes");
  const heart = page.locator('main button[aria-label*="Wunschliste"]').first();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");

  // Open that product — the page heart shows the same state. (During the view
  // transition both pages are briefly mounted, so the name comes from the heart's
  // accessible name rather than from an `h1` lookup.)
  await page.locator("main a[href^='/produkt/']").first().click();
  await expect(page).toHaveURL(/\/produkt\//);
  const pageHeart = page.getByRole("button", { name: /von der Wunschliste entfernen/ }).first();
  await expect(pageHeart).toHaveAttribute("aria-pressed", "true");
  const heartLabel = await pageHeart.getAttribute("aria-label");
  const productName = heartLabel!.replace(" von der Wunschliste entfernen", "");

  // The product page records the view → the home rail shows "Zuletzt angesehen".
  await page.goto("/");
  const rail = page.getByRole("region", { name: "Zuletzt angesehen" });
  await expect(rail).toBeVisible();
  await expect(rail.getByText(productName).first()).toBeVisible();

  // Register — the local wishlist merges into the new account.
  await page.goto("/konto/registrieren");
  await page.fill("#name", "Wunsch Person");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("checkbox", { name: /AGB/ }).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/konto$/, { timeout: 30_000 });

  await page.getByRole("link", { name: "Wunschliste", exact: true }).click();
  await expect(page).toHaveURL(/\/konto\/wunschliste/);
  await expect(page.getByText(productName).first()).toBeVisible();

  // Logout → login: the wishlist survives (it lives on the account now).
  await page.goto("/konto/profil");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.goto("/konto/anmelden");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/konto$/, { timeout: 30_000 });
  await page.goto("/konto/wunschliste");
  await expect(page.getByText(productName).first()).toBeVisible();

  // Remove it from the portal — it is gone from the account and the heart follows.
  await page.getByRole("button", { name: "Entfernen", exact: true }).first().click();
  await expect(page.getByText("Noch keine gemerkten Produkte")).toBeVisible();
});

test("sold-out variant offers the back-in-stock notification (issue #46)", async ({ page }) => {
  test.setTimeout(120_000);

  const target = await soldOutVariant(page);
  test.skip(target === null, "seed has no sold-out variant");

  await page.goto(`/produkt/${target!.slug}`);
  const attributes = target!.attributes;
  const picks: [string, string][] = [];
  if (attributes.color !== undefined) picks.push(["Farbe", String(attributes.color)]);
  if (attributes.size !== undefined) picks.push(["Grösse", String(attributes.size)]);
  if (attributes.storage !== undefined) picks.push(["Speicher", `${attributes.storage} GB`]);
  if (attributes.material !== undefined) picks.push(["Material", String(attributes.material)]);
  for (const [group, value] of picks) {
    await page.getByRole("group", { name: group }).getByRole("button", { name: value, exact: true }).click();
  }

  await expect(page.getByText("Benachrichtigen, wenn wieder verfügbar")).toBeVisible();
  await page.fill('input[type="email"]', "wieder-da@example.ch");
  await page.getByRole("button", { name: "Benachrichtigen" }).click();
  await expect(page.getByText("ist vorgemerkt")).toBeVisible();
});
