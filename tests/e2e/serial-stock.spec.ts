import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #62 (#54): a bought smartphone leaves stock with its exact serial — the
// unit is reserved at checkout, travels on the packing slip, ships with the label
// and is booked out (sold) on delivery; the ledger traces it the whole way.

interface ApiVariant {
  sku: string;
  label: string;
  stock: number;
}

async function buyOneSmartphone(page: Page): Promise<{ orderNumber: string; sku: string }> {
  const response = await page.request.get("/api/products?type=smartphone&sort=newest");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    items: { slug: string; variants: ApiVariant[] }[];
  };
  const target = body.items
    .flatMap((item) => item.variants.filter((v) => v.stock > 0).map((v) => ({ slug: item.slug, variant: v })))
    .find((entry) => entry.variant.label.length > 0);
  expect(target, "seed must contain a sellable smartphone").toBeDefined();

  await page.goto(`/products/${target!.slug}`);
  await expect(page.getByRole("button", { name: /Bitte .* wählen/ })).toBeDisabled();
  // Pick exactly that variant: the label parts are the dimension buttons.
  for (const part of target!.variant.label.split(" / ")) {
    await page.getByRole("button", { name: part, exact: true }).first().click();
  }
  await page.getByRole("button", { name: "In den Warenkorb" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Zur Kasse" }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.fill("#name", "Sofia Serial");
  await page.fill("#email", "sofia.serial@example.ch");
  await page.fill("#phone", "079 555 77 88");
  await page.fill("#street", "Imeiweg 3");
  await page.fill("#postalCode", "8001");
  await page.fill("#city", "Zürich");
  await page.getByRole("button", { name: /Jetzt kaufen/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
  return { orderNumber, sku: target!.variant.sku };
}

test("a serial-tracked sale is traceable from checkout to sold", async ({ page }) => {
  test.setTimeout(180_000);

  // --- Customer buys one smartphone; checkout reserves a concrete unit.
  const { orderNumber, sku } = await buyOneSmartphone(page);

  // --- Admin ledger: the unit is reserved for this order — read its serial.
  await loginAsAdmin(page);
  await page.goto(`/admin/stock-units?q=${encodeURIComponent(sku)}`);
  const reservedCard = page
    .locator("article")
    .filter({ hasText: `Bestellung ${orderNumber}` })
    .first();
  await expect(reservedCard).toBeVisible({ timeout: 30_000 });
  await expect(reservedCard.getByText("Reserviert").first()).toBeVisible();
  const serial = (await reservedCard.locator("p.font-mono").first().innerText()).trim();
  expect(serial.length).toBeGreaterThan(3);

  // --- paid → picking → packed: the unit travels; the packing slip names it.
  await page.goto("/admin/orders?status=paid");
  const orderLink = page
    .locator('tbody a[href^="/admin/orders/"]', { hasText: orderNumber })
    .first();
  await expect(orderLink).toBeVisible({ timeout: 30_000 });
  await orderLink.click();
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f]{24}/);
  const orderUrl = page.url();
  await page.getByRole("button", { name: "→ In Kommission" }).click();
  await expect(page.getByText("Status aktualisiert.").first()).toBeVisible();
  await page.getByRole("button", { name: "→ Verpackt" }).click();
  await expect(page.getByRole("button", { name: "UPS-Etikett erstellen" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/admin/packing");
  await page.locator('a[href^="/admin/packing/"]', { hasText: orderNumber }).first().click();
  await expect(page.getByText(serial).first()).toBeVisible({ timeout: 30_000 });

  // --- Label → shipped: the unit ships with the parcel.
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "UPS-Etikett erstellen" }).click();
  await expect(page.getByText("Versandt").first()).toBeVisible({ timeout: 30_000 });

  // --- delivered: the unit is booked out of stock. Wait for the transition to
  // finish (button gone, badge shows the new status) before leaving the page.
  await page.getByRole("button", { name: "→ Zugestellt" }).click();
  await expect(page.getByRole("button", { name: "→ Zugestellt" })).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("Status aktualisiert.").first()).toBeVisible();

  // --- Ledger: the same serial now reads "Verkauft" with the full history.
  await page.goto(`/admin/stock-units?q=${encodeURIComponent(serial)}`);
  const soldCard = page.locator("article").filter({ hasText: serial }).first();
  await expect(soldCard.getByText("Verkauft").first()).toBeVisible({ timeout: 30_000 });
  for (const step of ["Reserviert", "Verpackt", "Versandt", "Verkauft"]) {
    await expect(soldCard.getByText(step).first()).toBeVisible();
  }
});
