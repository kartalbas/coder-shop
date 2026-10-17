import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const EMAIL = "rechnung.kunde@example.ch";
const PASSWORD = "Rechnung123Passwort";

async function addOneProductToCart(page: Page): Promise<void> {
  // The cheapest product — well inside the default invoice credit of a fresh account.
  const response = await page.request.get("/api/products?type=smartphone&sort=price-asc");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: { slug: string; variants: { sku: string }[] }[] };
  const product = body.items.find((item) => item.variants.length > 0);
  expect(product).toBeDefined();
  await page.goto(`/products/${product!.slug}`);
  for (const group of ["Farbe", "Grösse", "Speicher", "Material"]) {
    const buttons = page.getByRole("group", { name: group }).locator("button");
    if ((await buttons.count()) > 0) await buttons.first().click();
  }
  await page.getByRole("button", { name: "In den Warenkorb" }).click();
}

test("invoice order: open for customer and admin, markable as paid (issue #40)", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);

  // Registered customer — invoice is only offered to accounts.
  await page.goto("/account/register");
  await page.fill("#name", "Rechnung Kunde");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("checkbox", { name: /AGB/ }).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // Checkout with „Rechnung“.
  await addOneProductToCart(page);
  await page.goto("/checkout");
  await page.fill("#phone", "079 555 12 12");
  await page.fill("#street", "Rechnungsweg 9");
  await page.fill("#postalCode", "8001");
  await page.fill("#city", "Zürich");
  await page.getByRole("radio", { name: /Rechnung/ }).check();
  await expect(page.getByText(/Zahlbar innert 30 Tagen/)).toBeVisible();
  await page.getByRole("button", { name: /Bestellen —/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);

  // Confirmation: invoice block with reference, and the PDF is served.
  await expect(page.getByText("Zahlung per Rechnung")).toBeVisible();
  await expect(page.getByText(/Referenz/)).toBeVisible();
  const pdf = await page.request.get(`/orders/${orderNumber}/invoice`);
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Portal: the invoice is open.
  await page.goto("/account/invoices");
  await expect(page.getByText(orderNumber)).toBeVisible();
  await expect(page.getByText("Überfällig").first()).toBeHidden();
  await expect(page.getByText(/^Offen /).first()).toBeVisible();

  // Admin: visible in the open list, markable as paid.
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/admin/invoices");
  await expect(adminPage.getByText(orderNumber)).toBeVisible();

  const row = adminPage.locator("tr", { hasText: orderNumber });
  await row.locator('input[name="amount"]').fill("9999999");
  await row.getByRole("button", { name: "Zahlen" }).click();
  await expect(adminPage.getByText(/übersteigt den offenen Betrag/)).toBeVisible();

  const openText = await row.locator("td").nth(4).innerText();
  const openChf = openText.replace(/[^0-9.]/g, "");
  await row.locator('input[name="amount"]').fill(openChf);
  await row.getByRole("button", { name: "Zahlen" }).click();
  await expect(adminPage.getByText("Zahlung erfasst.")).toBeVisible();

  // Gone from "Offen", present under "Bezahlt".
  await expect(adminPage.locator("tr", { hasText: orderNumber })).toHaveCount(0, {
    timeout: 30_000,
  });
  await adminPage.goto("/admin/invoices?filter=paid");
  await expect(adminPage.getByText(orderNumber)).toBeVisible();
  await admin.close();

  // Portal: settled.
  await page.goto("/account/invoices");
  await expect(page.getByText(orderNumber)).toBeVisible();
  await expect(page.getByText(/Bezahlt · Total/)).toBeVisible();
});
