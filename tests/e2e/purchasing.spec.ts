import { expect, test } from "@playwright/test";
import { loginAsAdmin, readStockOfSku } from "./helpers";

test("purchasing: receiving an ordered PO increases variant stock", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  // Open the seeded purchase order in status "Bestellt".
  await page.goto("/admin/purchasing");
  const orderedRow = page.locator("tbody tr", { hasText: "Bestellt" }).first();
  await expect(orderedRow).toBeVisible();
  await orderedRow.locator('a[href^="/admin/purchasing/"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/^Bestellung E-\d{4}-\d{6}$/);
  const poUrl = page.url();

  // Collect the PO lines (SKU + ordered quantity).
  const lineRows = page.locator('section[aria-label="Positionen"] tbody tr');
  const lineCount = await lineRows.count();
  expect(lineCount).toBeGreaterThan(0);
  const lines: { sku: string; qty: number }[] = [];
  for (let i = 0; i < lineCount; i++) {
    const row = lineRows.nth(i);
    const sku = (await row.locator("td").first().locator("p.font-mono").innerText()).trim();
    const qty = Number((await row.locator("td").nth(1).innerText()).trim());
    expect(sku.length).toBeGreaterThan(0);
    expect(qty).toBeGreaterThan(0);
    lines.push({ sku, qty });
  }

  // Stock before the goods receipt.
  const stockBefore = new Map<string, number>();
  for (const line of lines) stockBefore.set(line.sku, await readStockOfSku(page, line.sku));

  // Wareneingang: ordered → received. Serial-tracked lines (issue #62) register each
  // piece — type one unique serial per received piece before submitting.
  await page.goto(poUrl);
  for (const line of lines) {
    const serials = page.getByLabel(`Seriennummern ${line.sku}`);
    if ((await serials.count()) > 0) {
      const stamp = Date.now();
      await serials.fill(
        Array.from({ length: line.qty }, (_, i) => `E2E-${stamp}-${line.sku}-${i}`).join("\n"),
      );
    }
  }
  await page.getByRole("button", { name: "Wareneingang" }).click();
  // The receipt flips the page to "Erhalten" and removes the Wareneingang button.
  await expect(page.getByRole("button", { name: "Wareneingang" })).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("Erhalten").first()).toBeVisible();

  // Stock after: every line's variant grew by exactly the ordered quantity.
  for (const line of lines) {
    const stockAfter = await readStockOfSku(page, line.sku);
    expect(stockAfter, `stock for ${line.sku}`).toBe((stockBefore.get(line.sku) ?? 0) + line.qty);
  }
});
