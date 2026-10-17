import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #42: a whole purchase order can be created with the keyboard only — the picker
// dialogs open from a button, search while typing, ↑/↓ select, Enter takes, Esc cancels.
test("purchasing: keyboard-only PO creation through the picker dialogs", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsAdmin(page);
  await page.goto("/admin/purchasing");

  // --- Esc cancels: open the article picker, search, press Escape, nothing is added.
  await page.getByRole("button", { name: /Artikel hinzufügen/ }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const search = dialog.getByRole("combobox");
  await expect(search).toBeFocused();
  await search.pressSequentially("iphone");
  await expect(dialog.getByRole("option").first()).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Noch keine Positionen")).toBeVisible();
  // Focus is back on the opener.
  await expect(page.getByRole("button", { name: /Artikel hinzufügen/ })).toBeFocused();

  // --- Enter selects: first option becomes a line.
  await page.keyboard.press("Enter");
  await search.pressSequentially("iphone");
  const firstOption = dialog.getByRole("option").first();
  await expect(firstOption).toBeVisible({ timeout: 30_000 });
  const firstName = (await firstOption.innerText()).split("\n")[0];
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Noch keine Positionen")).toBeHidden();
  const line = page.locator("li").filter({ has: page.getByRole("spinbutton") }).first();
  await expect(line).toContainText(firstName.split("\n")[0].slice(0, 12));

  // Quantity by keyboard: select-all + type.
  const qty = line.getByRole("spinbutton");
  await qty.focus();
  await qty.press("ControlOrMeta+a");
  await page.keyboard.type("3");

  // --- Supplier through the same dialog.
  // The form pre-selects the first supplier by name (ShoeSource AG) — pick a different
  // one to prove the dialog actually changes it.
  await page.getByRole("button", { name: /ShoeSource AG/ }).focus();
  await page.keyboard.press("Enter");
  const supplierDialog = page.getByRole("dialog");
  await expect(supplierDialog).toBeVisible();
  await supplierDialog.getByRole("combobox").pressSequentially("tech");
  const supplierOption = supplierDialog.getByRole("option").first();
  await expect(supplierOption).toBeVisible({ timeout: 30_000 });
  const supplierName = (await supplierOption.innerText()).split("\n")[0];
  await page.keyboard.press("Enter");
  await expect(supplierDialog).toBeHidden();
  await expect(page.getByRole("button", { name: new RegExp(supplierName) })).toBeVisible();

  // Submit with the keyboard.
  await page.getByRole("button", { name: "Bestellung anlegen" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/purchasing\/[0-9a-f]{24}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/^Bestellung E-\d{4}-\d{6}$/);
  // The line arrived with the keyboard-entered quantity.
  await expect(page.getByText(supplierName).first()).toBeVisible();
  await expect(page.locator('section[aria-label="Positionen"]').getByText("3", { exact: true }).first()).toBeVisible();
});
