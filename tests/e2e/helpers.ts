import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@codershop.ch";
export const ADMIN_PASSWORD = "Admin!2026";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  // A failed login stays on /admin/login — only the exact dashboard URL counts.
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

export async function readStockOfSku(page: Page, sku: string): Promise<number> {
  await page.goto(`/admin/products?q=${encodeURIComponent(sku)}`);
  // The SKU search is exact, so the single result row is the product of that SKU.
  const row = page.locator("tbody tr").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const stockText = await row.locator("td").nth(5).innerText();
  return Number(stockText.trim());
}
