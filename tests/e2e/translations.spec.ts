import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Issue #58: the translation table and the language rows are admin-editable — a text
// change is visible on reload, a new key is creatable, and a new language is a form
// (the "adding a language needs no code change" done-when, operable in the UI).

test("translations: edit a text, add a key, add a language", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  // --- Edit an existing seeded text: the French column of shop.cart.title.
  await page.goto("/admin/translations?q=shop.cart.title");
  const row = page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("shop.cart.title");
  const french = page.getByLabel(/Français/);
  await french.fill("Panier des tests");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });
  await page.goto("/admin/translations?q=shop.cart.title");
  await expect(
    page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first(),
  ).toContainText("Panier des tests");

  // --- A new key: German base + one language text.
  await page.goto("/admin/translations/neu");
  await page.getByLabel("Key", { exact: true }).fill("shop.e2e.greeting");
  await page.getByLabel(/Deutsch \(Basis/).fill("Hallo E2E");
  await page.getByLabel(/Italiano/).fill("Ciao E2E");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });
  await page.goto("/admin/translations?q=shop.e2e.greeting");
  const created = page.locator("tbody tr").filter({ hasText: "shop.e2e.greeting" }).first();
  await expect(created).toBeVisible({ timeout: 30_000 });
  await expect(created).toContainText("Ciao E2E");
  // Untranslated languages show the visible "fehlt" fallback marker.
  await expect(created.getByText("fehlt").first()).toBeVisible();

  // --- A new language is a row, not a deploy.
  await page.goto("/admin/translations/languages");
  const newLanguageForm = page.locator("form").last();
  await newLanguageForm.getByLabel("Code").fill("pt");
  await newLanguageForm.getByLabel("Name").fill("Português");
  await newLanguageForm.getByLabel("Intl-Locale").fill("pt-PT");
  await newLanguageForm.getByRole("button", { name: "Sprache anlegen" }).click();
  await expect(page.getByText("Sprache gespeichert").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-language-code="pt"]')).toBeVisible();
});

// #58 review: deactivating a language keeps its texts — editing any row afterwards
// (here: the German base) must not destroy them. Fails on the pre-fix build, where the
// editor only saw active languages and the save replaced the whole texts map.
test("translations: a deactivated language's texts survive the next edit", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);
  const frRow = page
    .locator("form")
    .filter({ has: page.locator('[data-language-code="fr"]') });
  try {
    await page.goto("/admin/translations?q=shop.cart.title");
    const row = page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("link", { name: "Bearbeiten" }).click();
    await page.getByLabel(/Français/).fill("Panier survécu");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });

    // Deactivate French in the languages editor.
    await page.goto("/admin/translations/languages");
    await frRow.getByRole("checkbox").uncheck();
    await frRow.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Sprache gespeichert").first()).toBeVisible({ timeout: 30_000 });

    // Edit the row's German base: the editor shows French marked as deactivated.
    await page.goto("/admin/translations?q=shop.cart.title");
    await page
      .locator("tbody tr")
      .filter({ hasText: "shop.cart.title" })
      .first()
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await expect(page.getByText("(deaktiviert)")).toBeVisible();
    await page.getByLabel(/Deutsch \(Basis/).fill("Warenkorb nach Deaktivierung");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });

    // Reactivate French — the text is still there.
    await page.goto("/admin/translations/languages");
    await frRow.getByRole("checkbox").check();
    await frRow.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Sprache gespeichert").first()).toBeVisible({ timeout: 30_000 });
    await page.goto("/admin/translations?q=shop.cart.title");
    await expect(
      page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first(),
    ).toContainText("Panier survécu");
  } finally {
    // Never leave French deactivated for the specs that follow.
    await page.goto("/admin/translations/languages").catch(() => {});
    const checkbox = frRow.getByRole("checkbox");
    if ((await checkbox.isChecked().catch(() => true)) === false) {
      await checkbox.check();
      await frRow.getByRole("button", { name: "Speichern" }).click();
      await expect(page.getByText("Sprache gespeichert").first()).toBeVisible({
        timeout: 30_000,
      });
    }
  }
});
