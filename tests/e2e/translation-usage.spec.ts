import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 editor slice: the edit page shows where a text is used (the checked-in
// extraction from the code) and a preview link per active language (the namespace
// table + the language rows) — both data, nothing guessed in the UI.

test("translation editor: usage files and per-language preview links", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await page.goto("/admin/translations/shop.cart.title");
  await expect(page.getByRole("heading", { name: "Verwendung" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("components/storefront/cart-page-view.tsx")).toBeVisible();
  await expect(page.getByText("components/storefront/cart-drawer.tsx")).toBeVisible();

  // One preview link per active language row; the French one points at /fr/cart.
  const fr = page.getByRole("link", { name: /Français/ });
  await expect(fr).toHaveAttribute("href", "/fr/cart");
  await expect(fr).toHaveAttribute("target", "_blank");
  for (const name of ["Deutsch", "Italiano", "Rumantsch", "Español"]) {
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
});

test("translation editor: admin keys preview their nav page, unused keys say so", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  // admin.* without a table entry previews the admin page its second segment names.
  await page.goto("/admin/translations/admin.products.title");
  const adminPreview = page.getByRole("link", { name: "/admin/products" });
  await expect(adminPreview).toHaveAttribute("href", "/admin/products");
  await expect(adminPreview).toHaveAttribute("target", "_blank");

  // A two-segment key the code references lists its file (the relaxed extraction).
  await page.goto("/admin/translations/shop.skip");
  await expect(page.getByText("components/storefront/skip-link.tsx")).toBeVisible();

  // A real row no production file references states that instead of listing files.
  await page.goto("/admin/translations/shop.header.title");
  await expect(page.getByText("Keine Verwendung im Code gefunden.")).toBeVisible();
});
