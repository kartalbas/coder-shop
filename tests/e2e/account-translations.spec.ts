import { expect, test } from "@playwright/test";

// Issue #58 step 3 (slice) — the home hero and the whole account area read their texts
// from the translation table: hero, categories and rails on the home page, the four
// auth pages, the portal pages and their forms, the password-rule checklist. German
// stays the base; these pages answered hard-coded German before the change, so every
// French assertion here fails on the pre-change build.

test("the French home page — hero, categories and rails — answers in French", async ({ page }) => {
  await page.goto("/fr");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Technologie, style et confort — chez vous en Suisse.",
    }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Nouveautés chaque semaine")).toBeVisible();
  await expect(page.getByText(/Prix équitables en CHF/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Découvrir maintenant/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Catégories" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Produits populaires" })).toBeVisible();
  // No German hero or rail copy remains on the French page.
  await expect(page.getByText("Technik, Style und Komfort")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Beliebte Produkte" })).toHaveCount(0);
});

test("the French login and registration pages answer in French", async ({ page }) => {
  await page.goto("/fr/account/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Se connecter" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page.getByRole("link", { name: "Oublié ?" })).toBeVisible();
  await expect(page.getByText("Pas encore de compte ?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toHaveCount(0);

  await page.goto("/fr/account/register");
  await expect(
    page.getByRole("heading", { level: 1, name: "Créer un compte" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nom, prénom")).toBeVisible();
  // The live checklist speaks French too (the rule texts are table rows).
  await expect(page.getByText("au moins 10 caractères")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /CGV/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer un compte" })).toBeDisabled();
});

test("the French portal — overview, orders and profile — answers in French", async ({ page }) => {
  test.setTimeout(120_000);
  const email = "traduction.kunde@example.ch";

  // Register through the French form.
  await page.goto("/fr/account/register");
  await page.fill("#name", "Kundin Française");
  await page.fill("#email", email);
  await page.fill("#password", "Traduction123");
  await page.getByRole("checkbox", { name: /CGV/ }).check();
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // Overview: greeting, empty-order note, section cards, logout — all French.
  await page.goto("/fr/account");
  await expect(page.getByRole("heading", { level: 1, name: "Mon compte" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Connecté en tant que")).toBeVisible();
  await expect(page.getByText("Vous n'avez encore aucune commande dans votre compte.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Commandes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  await expect(page.getByText("Sie haben noch keine Bestellungen")).toHaveCount(0);

  // Orders: heading, search field and empty state.
  await page.goto("/fr/account/orders");
  await expect(
    page.getByRole("heading", { level: 2, name: "Historique des commandes" }),
  ).toBeVisible();
  await expect(page.getByLabel("Rechercher dans les commandes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechercher" })).toBeVisible();
  await expect(page.getByText("Aucune commande pour l'instant")).toBeVisible();

  // Profile: account data and the password card.
  await page.goto("/fr/account/profile");
  await expect(page.getByRole("heading", { level: 2, name: "Données du compte" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Modifier le mot de passe" })).toBeVisible();
  await expect(page.getByLabel("Mot de passe actuel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifier le mot de passe" })).toBeVisible();
});

test("the Spanish login page and password checklist answer in Spanish", async ({ page }) => {
  await page.goto("/es/account/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByText("¿Aún no tiene cuenta?")).toBeVisible();

  await page.goto("/es/account/reset-password");
  await expect(
    page.getByRole("heading", { level: 1, name: "Restablecer la contraseña" }),
  ).toBeVisible();
  await expect(page.getByText("Este enlace no es válido.")).toBeVisible();
});
