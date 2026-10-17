import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("admin: paid order → picking → packed → UPS label (mock) → shipped with tracking", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  // Open the first paid order.
  await page.goto("/admin/orders?status=paid");
  const firstOrder = page.locator('tbody a[href^="/admin/orders/"]').first();
  await expect(firstOrder).toBeVisible();
  const orderNumber = (await firstOrder.innerText()).trim();
  expect(orderNumber).toMatch(/^B-\d{4}-\d{6}$/);
  await firstOrder.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(orderNumber);

  // paid → picking: the picking transition runs, then the packed transition becomes offered.
  await page.getByRole("button", { name: "→ In Kommission" }).click();
  await expect(page.getByText("Status aktualisiert.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "→ Verpackt" })).toBeVisible({ timeout: 30_000 });

  // picking → packed: the label button appears only for packed orders.
  await page.getByRole("button", { name: "→ Verpackt" }).click();
  await expect(page.getByRole("button", { name: "UPS-Etikett erstellen" })).toBeVisible({
    timeout: 30_000,
  });

  // UPS label (mock provider) → shipped with a 1Z tracking number.
  await page.getByRole("button", { name: "UPS-Etikett erstellen" }).click();
  const trackingLocator = page.getByText(/1Z[0-9A-Z]{15,16}/).first();
  await expect(trackingLocator).toBeVisible({ timeout: 30_000 });
  const rawTracking = await trackingLocator.innerText();
  const tracking = rawTracking.match(/1Z[0-9A-Z]{15,16}/)?.[0] ?? "";
  expect(tracking).toMatch(/^1Z[0-9A-Z]{15,16}$/);
  await expect(page.getByText("Versandt").first()).toBeVisible();

  // The customer confirmation shows the tracking number once shipped.
  await page.goto(`/orders/${orderNumber}`);
  await expect(page.getByText(`Sendungsverfolgung: ${tracking}`)).toBeVisible();
});
