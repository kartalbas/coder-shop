import { expect, test } from "@playwright/test";
import { loginAsAdmin, readStockOfSku } from "./helpers";

// Issue #62 (#55): what is on order is visible where it matters — the PO shows the
// expected arrival, the shop shows "N Stk. bestellt, Ankunft ca. …" on a sold-out
// variant, and a goods receipt clears it. Runs on a quantity-tracked shoe: selling
// it out is a plain stock edit, which serial-tracked variants refuse by design (#54).
test("incoming stock: ordered PO is visible in the shop, receipt clears it", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsAdmin(page);

  // --- Create a PO for one shoe variant through the picker.
  await page.goto("/admin/purchasing");
  await page.getByRole("button", { name: /Artikel hinzufügen/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").pressSequentially("nike");
  const option = dialog.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  const line = page.locator("li").filter({ has: page.getByRole("spinbutton") }).first();
  const qtyInput = line.getByRole("spinbutton");
  await qtyInput.press("ControlOrMeta+a");
  await qtyInput.fill("4");
  await page.getByRole("button", { name: "Bestellung anlegen" }).click();
  await expect(page).toHaveURL(/\/admin\/purchasing\/[0-9a-f]{24}$/, { timeout: 30_000 });

  const sku = (
    await page
      .locator('section[aria-label="Positionen"] tbody tr')
      .first()
      .locator("p.font-mono")
      .innerText()
  ).trim();

  // --- Order it: the PO gets an expected arrival from the supplier lead time.
  await page.getByRole("button", { name: "Bestellen" }).click();
  await expect(page.getByLabel("Erwartete Ankunft")).toBeVisible({ timeout: 30_000 });
  const poNumber = (await page.getByRole("heading", { level: 1 }).innerText()).replace(
    "Bestellung ",
    "",
  );

  // --- Admin product view: the variant shows the incoming quantity.
  await page.goto(`/admin/products?q=${encodeURIComponent(sku)}`);
  await page.locator("tbody tr").first().locator("a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const slug = (await page.locator("h1 ~ p span.font-mono").first().innerText()).trim();
  const variantRow = page.locator("form").filter({ hasText: sku }).first();
  const variantLabel = (await variantRow.locator("p.text-xs").first().innerText()).trim();
  // The seed may hold a second open PO for the same variant — assert "on order", not a number.
  await expect(variantRow.getByText(/bestellt/)).toBeVisible();

  // Sell the variant out so the shop shows the incoming note.
  await variantRow.getByLabel(`Lager ${sku}`).fill("0");
  await variantRow.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(`Variante ${sku} gespeichert.`)).toBeVisible({ timeout: 30_000 });

  // --- Shop: the sold-out variant says what is on order and when it arrives.
  await page.goto(`/products/${slug}`);
  for (const part of variantLabel.split(" / ")) {
    await page.getByRole("button", { name: part, exact: true }).first().click();
  }
  await expect(page.getByRole("button", { name: "Ausverkauft" })).toBeVisible();
  const note = page.getByText(/Stk\. bestellt, Ankunft ca\./).first();
  await expect(note).toBeVisible({ timeout: 30_000 });
  const incomingBefore = Number((await note.innerText()).match(/(\d+) Stk\./)?.[1] ?? "0");
  expect(incomingBefore).toBeGreaterThanOrEqual(4);

  // --- Goods receipt: the quantity arrives and the incoming note shrinks by exactly it.
  const stockBefore = await readStockOfSku(page, sku);
  await page.goto("/admin/purchasing");
  const poRow = page.locator("tbody tr", { hasText: poNumber }).first();
  await poRow.locator('a[href^="/admin/purchasing/"]').first().click();
  await page.getByRole("button", { name: "Wareneingang" }).click();
  // Fully received — the PO leaves "Bestellt" and the receipt form is gone.
  await expect(page.getByRole("button", { name: "Wareneingang" })).toBeHidden({ timeout: 30_000 });

  expect(await readStockOfSku(page, sku)).toBe(stockBefore + 4);
  await page.goto(`/products/${slug}`);
  for (const part of variantLabel.split(" / ")) {
    await page.getByRole("button", { name: part, exact: true }).first().click();
  }
  // The note shrinks by the received quantity; it disappears entirely when the
  // variant is no longer low in stock (restocked above its threshold).
  const noteAfter = page.getByText(/Stk\. bestellt, Ankunft ca\./).first();
  if ((await noteAfter.count()) > 0) {
    expect(Number((await noteAfter.innerText()).match(/(\d+) Stk\./)?.[1])).toBe(
      incomingBefore - 4,
    );
  }
});
