import { expect, test } from "@playwright/test";
import { seedCart } from "./helpers";

// Issue #58 step 3 (server-messages slice): customer-facing validation and action
// messages read the translation table. Before the change every zod message and action
// refusal was a hard-coded German literal, so all French assertions here fail on the
// pre-change build. German stays the base — the German specs keep passing untouched.

test("the French checkout answers field errors in French", async ({ page }) => {
  test.setTimeout(180_000);

  await seedCart(page, "/fr/products");
  await page.goto("/fr/checkout");
  const submit = page.getByRole("button", { name: /Acheter maintenant/ });
  await expect(submit).toBeVisible({ timeout: 30_000 });
  await submit.click();

  // Client-side validation through the label map — French messages at the fields.
  await expect(page.getByText("Veuillez indiquer votre nom")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Veuillez indiquer un e-mail valide")).toBeVisible();
  await expect(page.getByText("Indiquez un NPA à 4 chiffres")).toBeVisible();
  await expect(page.getByText("Veuillez indiquer la localité")).toBeVisible();
  await expect(page.getByText("Bitte Namen angeben")).toHaveCount(0);
  await expect(page.getByText("Bitte 4-stellige PLZ angeben")).toHaveCount(0);
});

test("a refused discount code is explained in French", async ({ page }) => {
  test.setTimeout(180_000);

  await seedCart(page, "/fr/products");
  await page.goto("/fr/checkout");
  await expect(
    page.getByRole("button", { name: /Acheter maintenant/ }),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Code promo").fill("GIBTS-NICHT");
  await page.getByRole("button", { name: "Einlösen" }).click();
  const alert = page.locator("p[role=alert]");
  await expect(alert).toContainText("Ce code promo est non valide ou expiré.", {
    timeout: 30_000,
  });
  await expect(alert).not.toContainText("Dieser Gutscheincode");
});

test("the order access form refuses a wrong e-mail in French", async ({ page }) => {
  test.setTimeout(180_000);

  // A real order through the French checkout, then a stranger (no access cookie)
  // trying the wrong address on the French access form.
  await seedCart(page, "/fr/products");
  await page.goto("/fr/checkout");
  const submit = page.getByRole("button", { name: /Acheter maintenant/ });
  await expect(submit).toBeVisible({ timeout: 30_000 });
  await page.fill("#name", "Élodie Test");
  await page.fill("#email", "elodie.validation@example.ch");
  await page.fill("#phone", "079 555 00 04");
  await page.fill("#street", "Rue de Test 8");
  await page.fill("#postalCode", "1003");
  await page.fill("#city", "Lausanne");
  await submit.click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderUrl = new URL(page.url()).pathname;

  const stranger = await page.context().browser()!.newContext();
  const foreign = await stranger.newPage();
  await foreign.goto(orderUrl);
  await expect(foreign.getByLabel("Adresse e-mail")).toBeVisible({ timeout: 30_000 });
  await foreign.getByLabel("Adresse e-mail").fill("falsch@example.ch");
  await foreign.getByRole("button", { name: "Afficher la commande" }).click();
  const alert = foreign.locator("p[role=alert]");
  await expect(alert).toContainText("La commande et l'adresse e-mail ne correspondent pas.", {
    timeout: 30_000,
  });
  await expect(alert).not.toContainText("stimmen nicht überein");
  await stranger.close();
});

test("the localized 404 page carries the French title", async ({ page }) => {
  // An unknown order number runs notFound() inside the [lang] tree — the boundary the
  // [lang] not-found page renders (unmatched URLs answer the global prefix-free
  // /_not-found, which stays German by design). With PPR the streamed 404 UI keeps
  // HTTP 200 (documented Next behaviour, same as the product page).
  await page.goto("/fr/orders/B-2020-000000");
  await expect(page).toHaveTitle("Page introuvable | coder-shop");
  await expect(page.locator("head link[rel=canonical]")).toHaveAttribute(
    "href",
    /\/fr\/orders\/B-2020-000000$/,
  );
});
