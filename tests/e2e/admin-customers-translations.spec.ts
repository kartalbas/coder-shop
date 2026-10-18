import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58 step 5 (dashboard, customers, reviews, discounts, mails, palette and
// picker slice): these admin areas answer in the admin's chosen language. Pre-change
// the pages were hard-coded German, so every French assertion fails on the previous
// build. The spec registers one customer (the seed ships no accounts) and otherwise
// only reads — it edits nothing, which also proves the pages render in French without
// touching any data.

test("dashboard, customers, reviews, discounts, mails and the palette answer in French", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // A customer account to open in the admin — registered through the public form
  // while the UI is still German, so the spec never depends on other specs' data.
  const email = `step5-e2e-${Date.now()}@example.ch`;
  await page.goto("/account/register");
  await page.fill("#name", "Françoise Test");
  await page.fill("#email", email);
  await page.fill("#password", "StepFunf!2026x");
  await page.getByRole("checkbox", { name: /AGB/ }).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  await loginAsAdmin(page);
  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible({
    timeout: 30_000,
  });

  try {
    // Dashboard: KPI cards, links and both table sections in French, German absent.
    await expect(page.getByText("Commandes ouvertes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir les commandes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dernières commandes" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Seuil" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Letzte Bestellungen" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Changer le mot de passe" })).toBeVisible();

    // Customers: heading, search and columns in French; the registered account opens
    // a detail page whose sections are French too.
    await page.goto("/admin/customers");
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
    await expect(page.getByPlaceholder("Rechercher un nom ou un e-mail")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Nom" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ouvert" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Bestellungen" })).toHaveCount(0);

    const search = page.getByLabel("Rechercher parmi les clients");
    await search.fill(email);
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByRole("link", { name: "Françoise Test" })).toBeVisible();
    await page.getByRole("link", { name: "Françoise Test" }).click();
    await expect(page.getByRole("link", { name: "Retour à la liste" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Factures ouvertes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gérer le compte" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bloquer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Konto verwalten" })).toHaveCount(0);

    // Reviews: heading, status tabs and the empty view in French.
    await page.goto("/admin/reviews");
    await expect(page.getByRole("heading", { name: "Avis" })).toBeVisible();
    await expect(page.getByRole("link", { name: "En cours d'examen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Approuvé" })).toBeVisible();
    await expect(page.getByText("Bewertungen")).toHaveCount(0);

    // Discounts: heading, create card and field labels in French.
    await page.goto("/admin/discounts");
    await expect(page.getByRole("heading", { name: "Promotions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Créer un nouveau code" })).toBeVisible();
    await expect(page.getByLabel("Type")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer le code" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Neuen Code anlegen" })).toHaveCount(0);

    // Mails: heading and intro in French.
    await page.goto("/admin/mails");
    await expect(page.getByRole("heading", { name: "E-mails" })).toBeVisible();
    await expect(page.getByText("tous les e-mails que la boutique aurait envoyés")).toBeVisible();
    await expect(page.getByText("Noch keine Mails")).toHaveCount(0);

    // Shortcuts overlay ("?") and the ⌘K palette speak French too. The palette's own
    // strings and the entity group chips come from the table; the German dialog name
    // "Befehle" is gone, so the German build cannot pass this.
    await page.goto("/admin");
    await page.waitForSelector('body[data-command-palette="ready"]');
    await page.keyboard.press("?");
    const overlay = page.getByTestId("shortcuts-overlay");
    await expect(overlay.getByRole("heading", { name: "Raccourcis clavier" })).toBeVisible();
    await expect(overlay.getByText("Ouvrir la palette de commandes")).toBeVisible();
    await expect(overlay.getByText("Befehlspalette öffnen")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Commandes" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Befehle" })).toHaveCount(0);
    // The picker's own strings (hint under the title) are French as well.
    await expect(
      dialog.getByText("La saisie recherche immédiatement"),
    ).toBeVisible();
    await dialog.getByRole("combobox").pressSequentially("B-2026-000001");
    await expect(
      dialog.getByRole("option", { name: /B-2026-000001/ }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  } finally {
    await page.getByRole("button", { name: /Deutsch/ }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 30_000,
    });
  }
});
