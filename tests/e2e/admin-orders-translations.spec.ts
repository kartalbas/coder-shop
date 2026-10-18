import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 step 2 (admin orders slice): the orders list and detail, the packing queue
// and the transition area answer in the admin's chosen language. Pre-change these
// pages were hard-coded German, so every French assertion fails on the previous build.

test("orders, order detail and packing answer in French", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("link", { name: "Commandes", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  try {
    // Orders list: heading, tab, columns and status badges in French, no German left.
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Commandes" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Toutes/ })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Client" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Kunde" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Bestellungen" })).toHaveCount(0);

    // Order detail: sections and history in French; the transition area renders either
    // the French buttons or the French end-of-flow note (statuses vary across the run).
    await page.getByRole("table").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: /^Commande B-/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Changement de statut" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Client" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Statuswechsel" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Verlauf" })).toHaveCount(0);
    await expect(
      page
        .getByRole("button", { name: /^(→ |Annuler)/ })
        .or(page.getByText("Aucune autre transition possible."))
        .first(),
    ).toBeVisible();

    // Packing queue: heading and intro in French.
    await page.goto("/admin/packing");
    await expect(page.getByRole("heading", { name: "Préparation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kommissionierung" })).toHaveCount(0);
  } finally {
    await page.getByRole("button", { name: /Deutsch/ }).click();
    await expect(page.getByRole("link", { name: "Bestellungen", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  }
});
