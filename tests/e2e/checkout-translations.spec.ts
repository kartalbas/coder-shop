import { expect, test } from "@playwright/test";
import { seedCart } from "./helpers";

// Issue #58 step 3 (slice) — the checkout body reads its texts from the translation
// table: guest banner, step legends, customer field labels, payment hints and cards,
// summary and submit answer in the request language; German stays the base byte-for-
// byte, so the German checkout specs keep selecting by their German texts. Fails on
// the pre-change build, where all of it was hard-coded German.

test("the French checkout answers in French", async ({ page }) => {
  await seedCart(page);
  await page.goto("/fr/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "Caisse" })).toBeVisible({
    timeout: 30_000,
  });
  // Guest banner, legends and customer fields.
  await expect(page.getByText("Vous avez déjà un compte ?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer un compte" })).toBeVisible();
  await expect(page.locator("#shipping legend")).toContainText("Livraison");
  await expect(page.locator("#payment legend")).toContainText("Paiement");
  await expect(page.getByRole("textbox", { name: "Nom, prénom" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "NPA" })).toBeVisible();
  // Summary and submit — the amount stays locale-formatted behind the translated verb.
  await expect(page.getByRole("heading", { name: "Récapitulatif de la commande" })).toBeVisible();
  await expect(page.getByText("Sous-total")).toBeVisible();
  await expect(page.getByRole("button", { name: /Acheter maintenant.*CHF/ })).toBeVisible();
  // The German checkout is gone from the French page — only unambiguous strings,
  // "Adresse" being identical in both languages.
  await expect(page.getByRole("button", { name: /Jetzt kaufen/ })).toHaveCount(0);
  await expect(page.getByText("Bestellübersicht")).toHaveCount(0);
  await expect(page.getByText("Zahlung")).toHaveCount(0);
});

test("the Spanish checkout summary and submit are Spanish", async ({ page }) => {
  await seedCart(page, "/es/products");
  await page.goto("/es/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "Caja" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Resumen del pedido" })).toBeVisible();
  await expect(page.getByText("Subtotal")).toBeVisible();
  await expect(page.locator("#shipping legend")).toContainText("Envío");
  await expect(page.getByRole("button", { name: /Comprar ahora.*CHF/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Jetzt kaufen/ })).toHaveCount(0);
});
