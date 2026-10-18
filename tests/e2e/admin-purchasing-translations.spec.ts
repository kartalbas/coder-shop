import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 step 4 (purchasing, suppliers, stock-units, pickup, invoices slice): these
// admin areas answer in the admin's chosen language. Pre-change the pages were
// hard-coded German, so every French assertion fails on the previous build. The spec
// only reads — it edits nothing, which also proves the pages render in French without
// touching any data.

test("purchasing, suppliers, stock-units, pickup and invoices answer in French", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("link", { name: "Achats", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  try {
    // Purchasing list: heading, new-order card and columns in French, no German left.
    await page.goto("/admin/purchasing");
    await expect(page.getByRole("heading", { name: "Achats" })).toBeVisible();
    await expect(page.getByText("Nouvelle commande")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "N° de commande" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Fournisseur" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Einkauf" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Lieferant" })).toHaveCount(0);

    // Purchase order detail: back link, title and sections in French.
    await page.getByRole("table").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: /^Commande E-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour aux achats" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Positions" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Prix unitaire" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Zeitpunkte" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Zurück zum Einkauf" })).toHaveCount(0);

    // Suppliers: heading, columns and the edit button in French.
    await page.goto("/admin/suppliers");
    await expect(page.getByRole("heading", { name: "Fournisseurs" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Délai de livraison" })).toBeVisible();
    await expect(page.getByText("Nouveau fournisseur")).toBeVisible();
    await expect(page.getByRole("link", { name: "Modifier" }).first()).toBeVisible();
    await expect(page.getByText("Neuer Lieferant")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Lieferanten" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Bearbeiten" })).toHaveCount(0);

    // Serial ledger: heading and search in French.
    await page.goto("/admin/stock-units");
    await expect(page.getByRole("heading", { name: "Stock serial" })).toBeVisible();
    await expect(page.getByPlaceholder("Numéro de série ou SKU…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rechercher" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Serienlager" })).toHaveCount(0);

    // Pickup queue: heading and intro in French (the seeded database has no open
    // pickups, so the queue table itself is not asserted).
    await page.goto("/admin/pickup");
    await expect(page.getByRole("heading", { name: "Retrait" })).toBeVisible();
    await expect(
      page.getByText("préparer, vérifier le code et encaisser"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Abholung" })).toHaveCount(0);

    // Invoice book: heading, tab and credit section in French (the seeded database has
    // no invoice orders, so the invoice table itself is not asserted).
    await page.goto("/admin/invoices");
    await expect(page.getByRole("heading", { name: "Factures" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ouverte" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Limites de crédit" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rechnungen" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Kreditlimiten" })).toHaveCount(0);
  } finally {
    await page.getByRole("button", { name: /Deutsch/ }).click();
    await expect(page.getByRole("link", { name: "Einkauf", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  }
});
