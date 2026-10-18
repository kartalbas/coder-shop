import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { E2E_PORT } from "./playwright.config";

// Issue #58 admin slice: the prefix-free admin follows the shared `lang` cookie — the
// sidebar switcher writes it and the whole admin (nav, login, messages) answers in the
// chosen language. Pre-change the admin was hard-coded German everywhere, so both
// tests fail on the previous build.

test("the admin switcher moves the whole sidebar into French and back", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);

  // German by default (no cookie, Accept-Language en-US is no active row → first row).
  await expect(page.getByRole("link", { name: "Bestellungen", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Français/ }).click();
  await expect(page.getByRole("link", { name: "Commandes", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Produits", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bestellungen", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Déconnexion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abmelden" })).toHaveCount(0);

  // The choice is the shared cookie — it survives a reload.
  await page.reload();
  await expect(page.getByRole("link", { name: "Commandes", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Deutsch/ }).click();
  await expect(page.getByRole("link", { name: "Bestellungen", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Commandes", exact: true })).toHaveCount(0);
});

test("the login page answers in the remembered language", async ({ page }) => {
  test.setTimeout(90_000);
  await page.context().addCookies([{ name: "lang", value: "fr", url: `http://127.0.0.1:${E2E_PORT}/` }]);
  await page.goto("/admin/login");

  await expect(page).toHaveTitle(/Connexion à l'administration/);
  await expect(page.getByText("Connectez-vous avec votre compte d'administrateur.")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmelden" })).toHaveCount(0);
  await expect(page.getByLabel("Passwort")).toHaveCount(0);
});
