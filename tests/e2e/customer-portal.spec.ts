import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const EMAIL = "neu.kunde@example.ch";
const PASSWORD = "NeuesKonto123";

async function addOneProductToCart(page: Page): Promise<void> {
  const response = await page.request.get("/api/products?type=smartphone");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: { slug: string; variants: { sku: string }[] }[] };
  const product = body.items.find((item) => item.variants.length > 0);
  expect(product).toBeDefined();
  await page.goto(`/products/${product!.slug}`);
  // Pick every variant dimension so the add-to-cart button enables (issue #18).
  for (const group of ["Farbe", "Grösse", "Speicher", "Material"]) {
    const buttons = page.getByRole("group", { name: group }).locator("button");
    if ((await buttons.count()) > 0) await buttons.first().click();
  }
  await page.getByRole("button", { name: "In den Warenkorb" }).click();
}

test("register → buy → logout → login → order with status in the portal", async ({ page }) => {
  test.setTimeout(150_000);

  // Registration with the strength hint and the consent checkbox.
  await page.goto("/account/register");
  await page.fill("#name", "Neue Kundin");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await expect(page.getByText("mindestens 10 Zeichen")).toBeVisible();
  await page.getByRole("checkbox", { name: /AGB/ }).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
  await expect(page.getByText(EMAIL)).toBeVisible();

  // Buy something — the checkout starts prefilled from the profile.
  await addOneProductToCart(page);
  await page.goto("/checkout");
  await expect(page.locator("#email")).toHaveValue(EMAIL);
  await page.fill("#phone", "079 555 99 11");
  await page.fill("#street", "Beispielweg 3");
  await page.fill("#postalCode", "8001");
  await page.fill("#city", "Zürich");
  await page.getByRole("button", { name: /Jetzt kaufen/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);

  // Logout, then log back in.
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/, { timeout: 30_000 });
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/login/);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // The order is in the portal with its current status, and opens with full details.
  await page.getByRole("link", { name: "Bestellungen", exact: true }).click();
  await expect(page.getByText(orderNumber).first()).toBeVisible();
  await expect(page.getByText("Bezahlt").first()).toBeVisible();
  await page.getByRole("link", { name: orderNumber }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(orderNumber);
  await expect(page.getByText("Beispielweg 3")).toBeVisible();
});

test("password reset via the dev outbox", async ({ page, browser }) => {
  test.setTimeout(150_000);

  await page.goto("/account/forgot-password");
  await page.fill("#email", EMAIL);
  await page.getByRole("button", { name: "Link anfordern" }).click();
  await expect(page.getByRole("status")).toContainText("Falls die Adresse registriert ist");

  // Read the reset link from the admin outbox (separate browser context = admin session).
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/admin/mails");
  await expect(adminPage.getByText("Passwort zurücksetzen").first()).toBeVisible();
  await adminPage.getByText("Passwort zurücksetzen").first().click();
  const body = await adminPage.textContent("main");
  // The token is exactly 43 base64url chars — a greedy + would swallow the next outbox row.
  const match = body?.match(/token=([A-Za-z0-9_-]{43})/);
  await admin.close();
  expect(match, "reset mail with a token link in the outbox").not.toBeNull();

  // Set a new password and log in with it.
  await page.goto(`/account/reset-password?token=${match![1]}`);
  await page.fill("#password", "AnderesPasswort1");
  await page.getByRole("button", { name: "Passwort setzen" }).click();
  await expect(page.getByRole("status")).toContainText("Passwort wurde geändert", {
    timeout: 30_000,
  });

  await page.goto("/account/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", "AnderesPasswort1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
});
