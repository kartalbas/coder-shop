import { expect, test } from "@playwright/test";
import { seedCart } from "./helpers";

// Issue #58 step 3 (slice) — the order confirmation flow reads its texts from the
// translation table: header, status chain and badge, invoice and pickup cards, totals,
// addresses and the PII access form. German stays the base; the pages answered
// hard-coded German before the change, so every French assertion fails on the
// pre-change build. This spec also completes step 5's two-language checkout: the
// German side is covered by storefront.spec, the French side is a full checkout here.

test("a completed French checkout shows the confirmation in French", async ({ page }) => {
  test.setTimeout(180_000);

  await seedCart(page, "/fr/products");
  await page.goto("/fr/checkout");
  await expect(page.getByRole("button", { name: /Acheter maintenant/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.fill("#name", "Jean Test");
  await page.fill("#email", "jean.confirmation@example.ch");
  await page.fill("#phone", "079 555 00 02");
  await page.fill("#street", "Rue de Test 6");
  await page.fill("#postalCode", "1003");
  await page.fill("#city", "Lausanne");
  await page.getByRole("button", { name: /Acheter maintenant/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });

  // Header, status badge and totals — the table's French rows, not German literals.
  await expect(page.getByText("Merci pour votre commande !")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: /^Commande B-\d{4}-\d{6}$/ }),
  ).toBeVisible();
  await expect(page.getByText("Vielen Dank für Ihre Bestellung")).toHaveCount(0);
  await expect(page.getByText("Total", { exact: true })).toBeVisible();
  await expect(page.getByText("Gesamt")).toHaveCount(0);

  // The status chain and its badge speak French (shop.status.* rows).
  const chain = page.getByRole("list", { name: "Statut de la commande" });
  await expect(chain).toBeVisible();
  await expect(chain.getByText("Payée")).toBeVisible();
  await expect(chain.getByText("Bezahlt")).toHaveCount(0);

  // The address block and the payment reference line.
  await expect(page.getByRole("heading", { level: 2, name: "Adresse de livraison" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Contact" })).toBeVisible();
  await expect(page.getByText(/Référence de paiement/)).toBeVisible();
  await expect(page.getByText("Lieferadresse")).toHaveCount(0);
});

test("a stranger opening the confirmation sees the access form in French", async ({ page }) => {
  test.setTimeout(180_000);

  // Produce a real order through the French checkout, then open its URL in a clean
  // context — no access cookie, no account — which gets the PII form only.
  await seedCart(page, "/fr/products");
  await page.goto("/fr/checkout");
  await expect(page.getByRole("button", { name: /Acheter maintenant/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.fill("#name", "Jacques Test");
  await page.fill("#email", "jacques.confirmation@example.ch");
  await page.fill("#phone", "079 555 00 03");
  await page.fill("#street", "Rue de Test 7");
  await page.fill("#postalCode", "1003");
  await page.fill("#city", "Lausanne");
  await page.getByRole("button", { name: /Acheter maintenant/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderUrl = new URL(page.url()).pathname;

  const stranger = await page.context().browser()!.newContext();
  const foreign = await stranger.newPage();
  await foreign.goto(orderUrl);
  await expect(
    foreign.getByRole("heading", { level: 2, name: "Confirmer la commande" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(foreign.getByText(/nous n'affichons les détails de/)).toBeVisible();
  await expect(foreign.getByLabel("Adresse e-mail")).toBeVisible();
  await expect(foreign.getByRole("button", { name: "Afficher la commande" })).toBeVisible();
  await expect(foreign.getByText("Bestellung bestätigen")).toHaveCount(0);
  await expect(foreign.getByRole("button", { name: "Bestellung anzeigen" })).toHaveCount(0);
  await stranger.close();
});
