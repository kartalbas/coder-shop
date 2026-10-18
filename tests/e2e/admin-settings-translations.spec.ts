import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 step 3 (admin products, settings, translations slice): the product list and
// detail, the shop settings and the translation table answer in the admin's chosen
// language. Pre-change these pages were hard-coded German, so every French assertion
// fails on the previous build. The spec only reads — it edits nothing, which also proves
// the pages render in French without touching any data.

test("products, settings and the translation table answer in French", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("link", { name: "Produits", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  try {
    // Product list: heading, columns and search in French, no German left.
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Produits" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Marque" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Prix de base" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Rechercher par nom, marque ou SKU…"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Produkte" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Marke" })).toHaveCount(0);

    // Product detail: sections and variant fields in French.
    await page.getByRole("table").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Données de base" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Variantes \(\d+\)/ })).toBeVisible();
    await expect(page.getByLabel(/Différence de prix \(CHF\)/).first()).toBeVisible();
    await expect(page.getByLabel(/Poids \(g\)/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stammdaten" })).toHaveCount(0);

    // Shop settings: heading and field labels in French.
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();
    await expect(page.getByLabel("Taux de TVA (pour cent)")).toBeVisible();
    await expect(page.getByLabel("Livraison gratuite à partir de (CHF)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Modes de livraison" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Modes de paiement" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Versandarten" })).toHaveCount(0);

    // Translation table: title, filter chrome and column header in French.
    await page.goto("/admin/translations");
    await expect(page.getByRole("heading", { name: "Traductions" })).toBeVisible();
    await expect(page.getByLabel("Rechercher dans les traductions")).toBeVisible();
    await expect(page.getByLabel("Filtrer par traduction manquante")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Allemand" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Übersetzungen" })).toHaveCount(0);
  } finally {
    await page.getByRole("button", { name: /Deutsch/ }).click();
    await expect(page.getByRole("link", { name: "Produkte", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  }
});
