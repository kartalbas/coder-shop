import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// The palette's key handlers exist only after hydration — never press before that.
async function gotoReady(page: import("@playwright/test").Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('body[data-command-palette="ready"]');
}

// Issue #49: ⌘K/Ctrl+K opens the command palette anywhere in the admin; orders and
// products are reachable by typing; "?" lists the shortcuts.
test("command palette opens orders and products by search", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await gotoReady(page, "/admin");

  // Ctrl+K opens the palette with focus in the search field.
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Befehle" });
  await expect(dialog).toBeVisible();
  const search = dialog.getByRole("combobox");
  await expect(search).toBeFocused();

  // An order by its number → Enter navigates to its detail page.
  await search.pressSequentially("B-2026-000001");
  const orderOption = dialog.getByRole("option", { name: /B-2026-000001/ }).first();
  await expect(orderOption).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f]{24}/);
  await expect(page.getByText("B-2026-000001").first()).toBeVisible();
  await expect(dialog).toBeHidden();

  // A product by name → Enter navigates to its edit page.
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await expect(search).toHaveValue("");
  await search.pressSequentially("iphone");
  const productOption = dialog.getByRole("option", { name: /iPhone/i }).first();
  await expect(productOption).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f]{24}/);
  await expect(dialog).toBeHidden();

  // Pages and actions are in the palette too.
  await page.keyboard.press("Control+k");
  await search.pressSequentially("neue eink");
  await expect(
    dialog.getByRole("option", { name: /Neue Einkaufsbestellung/ }),
  ).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("question mark opens the shortcuts overlay", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await gotoReady(page, "/admin");

  await page.keyboard.press("?");
  const overlay = page.getByTestId("shortcuts-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText("Befehlspalette öffnen")).toBeVisible();
  await expect(overlay.getByText("Diese Übersicht öffnen")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();

  // While typing in a field "?" is a character, not a shortcut.
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Befehle" }).getByRole("combobox");
  await search.pressSequentially("?");
  await expect(page.getByTestId("shortcuts-overlay")).toBeHidden();
});
