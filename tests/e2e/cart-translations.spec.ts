import { expect, test } from "@playwright/test";
import { seedCart } from "./helpers";

// Issue #58 step 3 (slice) — the cart flow reads its texts from the translation table.
// The empty state, the drawer, the summary, the quantity/remove aria labels, the free
// shipping sentence and the discount field answer in the request language; German
// stays the base. Fails on the pre-change build, where all of it was hard-coded German.
// The hermetic seedCart lives in helpers.ts (shared with checkout-translations).

test("the empty French cart page answers in French", async ({ page }) => {
  await page.goto("/fr/cart");
  await expect(
    page.getByRole("heading", { level: 1, name: "Votre panier est vide" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Continuer vos achats" })).toBeVisible();
  await expect(
    page.getByText("Découvrez notre assortiment de smartphones"),
  ).toBeVisible();
  await expect(page.getByText("Ihr Warenkorb ist leer")).toHaveCount(0);
  await expect(page.getByText("Entdecken Sie unser Sortiment")).toHaveCount(0);
});

test("the filled French cart page, summary and discount field are French", async ({ page }) => {
  await seedCart(page);
  await page.goto("/fr/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Panier" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Résumé" })).toBeVisible();
  await expect(page.getByText("Sous-total")).toBeVisible();
  await expect(page.getByRole("link", { name: "Passer à la caisse" })).toBeVisible();
  // Aria labels follow the language — the German pattern is gone.
  await expect(page.getByRole("button", { name: /^Retirer :/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Entfernen:/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Diminuer la quantité :/ }),
  ).toBeVisible();
  // The free-shipping sentence is translated and carries the formatted amount.
  await expect(page.getByText(/Encore .* pour la livraison gratuite/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Code promo" })).toBeVisible();
});

test("the French cart drawer answers in French", async ({ page }) => {
  await seedCart(page);
  await page.goto("/fr/products");
  // The header's own control labels follow the language — the drawer is reached through
  // the language-independent test id, and no German label remains in the French header.
  await expect(page.getByTestId("cart-button")).toHaveAttribute("aria-label", /^Panier,/);
  await expect(page.getByRole("combobox", { name: "Recherche rapide" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activer le thème clair ou sombre" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Warenkorb/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Helles oder dunkles Design aktivieren" }),
  ).toHaveCount(0);
  await page.getByTestId("cart-button").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Panier" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(drawer.getByText("Sous-total")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Passer à la caisse" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: /^Retirer :/ })).toBeVisible();
});
