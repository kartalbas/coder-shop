import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

async function addOneProductToCart(page: Page): Promise<void> {
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

test("pickup order: checkout → ready → handover with code → abgeholt und bezahlt (issue #41)", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);

  // Guest checkout with pickup shipping and pay-on-pickup.
  await addOneProductToCart(page);
  await page.goto("/checkout");
  await page.fill("#name", "Hans Abholung");
  await page.fill("#email", "hans.abholung@example.ch");
  await page.fill("#phone", "079 555 98 76");
  await page.fill("#street", "Testweg 3");
  await page.fill("#postalCode", "8001");
  await page.fill("#city", "Zürich");
  await page.getByRole("radio", { name: /Abholung im Laden/ }).check();
  await expect(page.getByRole("radio", { name: /Bei Abholung/ })).toBeVisible();
  await page.getByRole("radio", { name: /Bei Abholung/ }).check();
  await expect(page.getByText("Bar oder Karte vor Ort")).toBeVisible();
  await page.getByRole("button", { name: /Bestellen —|Jetzt kaufen/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);

  // Confirmation: pickup block with store address, code and QR — and no tracking.
  await expect(page.getByText("Abholung im Laden").first()).toBeVisible();
  await expect(page.getByText("Bahnhofstrasse 1")).toBeVisible();
  const code = (await page.locator("p.font-mono.text-2xl").first().innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(page.getByRole("img", { name: new RegExp(`QR-Code mit Abholcode ${code}`) })).toBeVisible();
  await expect(page.getByText("Sie erhalten den Abholcode, sobald die Bestellung bereit liegt.")).toBeVisible();

  // Admin pickup queue: mark ready, hand over with the right code.
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/admin/pickup");
  const row = adminPage.locator("tr", { hasText: orderNumber });
  await expect(row).toBeVisible();
  await expect(row.getByText(code)).toBeVisible();

  await row.getByRole("button", { name: "Bereit zur Abholung" }).click();
  await expect(adminPage.getByText("Bereit zur Abholung.", { exact: true })).toBeVisible();
  await expect(row.getByText("Bereit zur Abholung").first()).toBeVisible();

  // Wrong code is refused, the order stays ready.
  await row.getByLabel("Abholcode").fill("XX00XX");
  await row.getByRole("button", { name: "Übergeben & bezahlen" }).click();
  await expect(adminPage.getByText(/Abholcode stimmt nicht/)).toBeVisible();

  // Right code + card: collected and paid in one step.
  await row.getByLabel("Abholcode").fill(code);
  await row.getByText("Karte", { exact: true }).click();
  await row.getByRole("button", { name: "Übergeben & bezahlen" }).click();
  await expect(adminPage.getByText("Abgeholt und bezahlt.")).toBeVisible();
  await expect(adminPage.locator("tr", { hasText: orderNumber })).toHaveCount(0, {
    timeout: 30_000,
  });

  // Confirmation reflects the completed pickup; the order left the queue for good.
  await page.reload();
  await expect(page.getByText("Abgeholt").first()).toBeVisible();
  await expect(page.getByText(/bezahlt \(Karte\)/)).toBeVisible();
  await admin.close();
});
