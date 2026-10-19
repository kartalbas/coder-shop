import { expect, test } from "@playwright/test";
import { seedCart } from "./helpers";
import { valueLabelKey } from "../../src/lib/i18n";
import translationsJson from "../../src/server/translations.json";

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
  // Language-independent selection (#58 review): the button carries a testid, so the
  // spec never cements a German label on a French page.
  const redeem = page.getByTestId("discount-redeem");
  await expect(redeem).toHaveText("Utiliser");
  await expect(page.getByRole("button", { name: "Einlösen" })).toHaveCount(0);
  await redeem.click();
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
  // [lang] not-found page renders. With PPR the streamed 404 UI keeps HTTP 200
  // (documented Next behaviour, same as the product page).
  await page.goto("/fr/orders/B-2020-000000");
  await expect(page).toHaveTitle("Page introuvable | coder-shop");
  await expect(page.locator("head link[rel=canonical]")).toHaveAttribute(
    "href",
    /\/fr\/orders\/B-2020-000000$/,
  );
});

test("a duplicate registration is refused in French", async ({ page }) => {
  test.setTimeout(150_000);

  // #58 core-error slice: the register core answers its refusals from the table —
  // pre-change this was the hard-coded German "Diese E-Mail-Adresse ist bereits
  // registriert." on every language.
  const email = "dup.validation@example.ch";
  await page.goto("/fr/account/register");
  await page.fill("#name", "Léa Dup");
  await page.fill("#email", email);
  await page.fill("#password", "Sicheres123!");
  await page.locator("#consent").check();
  await page.getByRole("button", { name: "Créer un compte" }).click();
  // The action redirect is a client-side navigation — the URL keeps the language it
  // rendered in (html lang="fr"), the prefix itself is not re-added until the next
  // document request; the German portal spec asserts the same shape.
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // A second, logged-out attempt with the same address gets the French refusal.
  const other = await page.context().browser()!.newContext();
  const foreign = await other.newPage();
  await foreign.goto("/fr/account/register");
  await foreign.fill("#name", "Léa Bis");
  await foreign.fill("#email", email);
  await foreign.fill("#password", "Sicheres123!");
  await foreign.locator("#consent").check();
  await foreign.getByRole("button", { name: "Créer un compte" }).click();
  await expect(foreign.getByRole("alert").filter({ hasText: "déjà enregistrée" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(foreign.getByText("bereits registriert")).toHaveCount(0);
  await other.close();
});

test("the restock form refuses an invalid e-mail in French", async ({ page }) => {
  test.setTimeout(150_000);

  // The back-in-stock form lives on the public product page; its zod message is a
  // table row now (pre-change: German on every language).
  let target: { slug: string; attributes: Record<string, string | number> } | null = null;
  for (const type of ["smartphone", "shoes", "clothing"]) {
    const response = await page.request.get(`/api/products?type=${type}`);
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      items: { slug: string; variants: { stock: number; attributes: Record<string, string | number> }[] }[];
    };
    for (const item of body.items) {
      const variant = item.variants.find((v) => v.stock === 0);
      if (variant) {
        target = { slug: item.slug, attributes: variant.attributes };
        break;
      }
    }
    if (target) break;
  }
  test.skip(target === null, "seed has no sold-out variant");

  await page.goto(`/fr/products/${target!.slug}`);
  // Issue #58 step B1b: on /fr the picker chips carry the translated value (fallback:
  // the value itself) — the display text is derived from the same seed file the
  // server renders from, exactly like the storefront resolves it.
  const rows = translationsJson as { key: string; texts: Record<string, string> }[];
  for (const [group, value] of Object.entries(target!.attributes)) {
    const row = rows.find((candidate) => candidate.key === valueLabelKey(group, String(value)));
    const text = row?.texts.fr?.trim() || String(value);
    const display = group === "storage" ? `${text} GB` : text;
    await page.getByRole("button", { name: display, exact: true }).first().click();
  }

  const emailInput = page.getByLabel(/e-mail pour l'avertissement/i);
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  // The browser's own e-mail validation must not answer before the server action —
  // the test drives the action's zod refusal, so the form's native validation is
  // switched off (relaxing the input type does not hold: React restores it on the
  // next controlled render).
  await emailInput.evaluate((el: HTMLElement) => el.closest("form")?.setAttribute("novalidate", ""));
  await emailInput.fill("pas-un-email");
  await page.getByRole("button", { name: "M'avertir" }).click();
  // The refusal arrives as a toast (same shape the #46 restock spec asserts), not an
  // inline alert — asserted on the suite's established sonner toast region.
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast.filter({ hasText: "Veuillez indiquer une adresse e-mail valide" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(toast.filter({ hasText: "Bitte eine gültige E-Mail-Adresse" })).toHaveCount(0);
});

test("unmatched URLs and unknown products answer the global 404 in French", async ({
  page,
}) => {
  // #58 review: the global prefix-free /_not-found (every unmatched URL, and the
  // proxy's real-404 rewrite for unknown product slugs) resolves the request language
  // too — title, body and buttons follow the remembered `lang` cookie.
  const response = await page.goto("/fr/products/gibts-nicht");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page introuvable | coder-shop");
  await expect(page.getByText("Cette page n'existe pas ou a été déplacée")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Parcourir l'assortiment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toHaveCount(0);

  await page.goto("/fr/gibts-nicht");
  await expect(page).toHaveTitle("Page introuvable | coder-shop");
  await expect(page.getByText("Cette page n'existe pas ou a été déplacée")).toBeVisible();
});
