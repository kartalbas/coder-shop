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
  const french = page.getByRole("textbox", { name: /Français/ });
  await french.fill("Panier des tests");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });
  await page.goto("/admin/translations?q=shop.cart.title");
  await expect(
    page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first(),
  ).toContainText("Panier des tests");

  // --- A new key: German base + one language text.
  await page.goto("/admin/translations/new");
  await page.getByLabel("Key", { exact: true }).fill("shop.e2e.greeting");
  await page.getByRole("textbox", { name: /Deutsch \(Basis/ }).fill("Hallo E2E");
  await page.getByRole("textbox", { name: /Italiano/ }).fill("Ciao E2E");
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
    await page.getByRole("textbox", { name: /Français/ }).fill("Panier survécu");
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
    await page.getByRole("textbox", { name: /Deutsch \(Basis/ }).fill("Warenkorb nach Deaktivierung");
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

// #58 step 4: the "missing in language X" filter — the editor's answer to "what still
// has to be translated?". Fails on the pre-fix build, where the `missing` parameter was
// ignored and every row stayed listed.
test("translations: the missing-in-language filter lists only untranslated rows", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  // A row translated in Italian only — missing in French and every other language.
  await page.goto("/admin/translations/new");
  await page.getByLabel("Key", { exact: true }).fill("shop.e2e.missing-filter");
  await page.getByRole("textbox", { name: /Deutsch \(Basis/ }).fill("Filter-Test");
  await page.getByRole("textbox", { name: /Italiano/ }).fill("Prova di filtro");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });

  const row = page.locator("tbody tr").filter({ hasText: "shop.e2e.missing-filter" });
  const seeded = page.locator("tbody tr").filter({ hasText: "shop.cart.title" });

  // Missing in French: the new row is listed, the fully translated seeded row is not.
  await page.goto("/admin/translations?missing=fr");
  await expect(row.first()).toBeVisible({ timeout: 30_000 });
  await expect(seeded).toHaveCount(0);
  await expect(page.getByLabel("Nach fehlender Übersetzung filtern")).toHaveValue("fr");

  // Missing in Italian: the new row has an Italian text, so nothing is left —
  // every seeded row is translated in Italian.
  await page.goto("/admin/translations?missing=it");
  await expect(row).toHaveCount(0);
  await expect(page.getByText("Keine Texte gefunden.")).toBeVisible();

  // Junk values fall back to the unfiltered list — searched, because the table has
  // outgrown the list cap and the row is no longer on the first page.
  await page.goto("/admin/translations?missing=xx&q=shop.cart.title");
  await expect(seeded.first()).toBeVisible({ timeout: 30_000 });
});

// #58 editor slice: per-text freshness — editing the German base flags every language
// text as "needs review" (badge + review filter), editing the text clears its marker,
// and the edit page shows the change history with the actor. Fails on the pre-fix
// build: no marker, no filter, no history.
test("translations: freshness marker, review filter and change history", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);
  try {
    // Edit the German base of a seeded row: every existing text is now older.
    await page.goto("/admin/translations?q=shop.cart.title");
    const row = page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("link", { name: "Bearbeiten" }).click();
    await page.getByRole("textbox", { name: /Deutsch \(Basis/ }).fill("Warenkorb (Geschichte)");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });

    // The list flags the stale texts with the amber marker.
    await page.goto("/admin/translations?q=shop.cart.title");
    const flagged = page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
    await expect(flagged.getByText("Prüfen").first()).toBeVisible({ timeout: 30_000 });

    // The review filter finds exactly this row for French.
    await page.goto("/admin/translations?review=fr&q=shop.cart.title");
    await expect(flagged).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Nach zu prüfenden Übersetzungen filtern")).toHaveValue("fr");

    // Editing the French text clears its marker; the untouched languages stay flagged.
    await flagged.getByRole("link", { name: "Bearbeiten" }).click();
    await page.getByRole("textbox", { name: /Français/ }).fill("Panier (Geschichte)");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });

    await page.goto("/admin/translations?q=shop.cart.title");
    const updated = page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
    await expect(
      updated.locator("td").filter({ hasText: "Panier (Geschichte)" }).first(),
    ).not.toContainText("Prüfen");
    await expect(updated.getByText("Prüfen").first()).toBeVisible();
    await page.goto("/admin/translations?review=fr&q=shop.cart.title");
    await expect(
      page.locator("tbody tr").filter({ hasText: "shop.cart.title" }),
    ).toHaveCount(0);

    // The edit page shows the change history with actor and old → new.
    await page.goto("/admin/translations?q=shop.cart.title");
    await page
      .locator("tbody tr")
      .filter({ hasText: "shop.cart.title" })
      .first()
      .getByRole("link", { name: "Bearbeiten" })
      .click();
    await expect(page.getByRole("heading", { name: "Änderungsgeschichte" })).toBeVisible();
    await expect(page.getByText("Warenkorb (Geschichte)").first()).toBeVisible();
    await expect(page.getByText("Panier (Geschichte)").first()).toBeVisible();
    await expect(page.getByText("von admin@codershop.ch").first()).toBeVisible();
  } finally {
    // Restore the German base for the specs that follow (shared server).
    await page.goto("/admin/translations?q=shop.cart.title").catch(() => {});
    const row = page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.getByRole("link", { name: "Bearbeiten" }).click();
      await page.getByRole("textbox", { name: /Deutsch \(Basis/ }).fill("Warenkorb");
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page).toHaveURL(/\/admin\/translations(\?.*)?$/, { timeout: 30_000 });
    }
  }
});

// #58 editor inline-editing slice: the list itself is editable — every text cell is a
// button, Enter saves the cell instantly through the one core (toast + the value
// survives a reload), Esc cancels a change, and editing the German base flags the
// other languages for review right in the table. Fails on the pre-fix build: the cells
// were plain text, no edit buttons existed.
test("translations: inline editing in the list — Enter saves, Esc cancels", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);
  const row = () => page.locator("tbody tr").filter({ hasText: "shop.cart.title" }).first();
  const cell = (language: string) =>
    row().getByRole("button", { name: new RegExp(`shop\\.cart\\.title.*${language}`) });
  const input = (language: string) =>
    row().getByRole("textbox", { name: new RegExp(`shop\\.cart\\.title.*${language}`) });
  const saved = () =>
    expect(page.getByText("Übersetzung gespeichert").first()).toBeVisible({ timeout: 30_000 });
  try {
    await page.goto("/admin/translations?q=shop.cart.title");
    await expect(row()).toBeVisible({ timeout: 30_000 });

    // Edit the French cell inline: type + Enter saves instantly, reload keeps it.
    await cell("Français").click();
    await input("Français").fill("Panier en ligne");
    await input("Français").press("Enter");
    await saved();
    await expect(cell("Français")).toContainText("Panier en ligne");
    await page.goto("/admin/translations?q=shop.cart.title");
    await expect(row()).toContainText("Panier en ligne");

    // Esc cancels: the draft never reaches the row, the old text stays.
    await cell("Italiano").click();
    await input("Italiano").fill("Carrello cancellato");
    await input("Italiano").press("Escape");
    await expect(row().getByRole("textbox")).toHaveCount(0);
    await expect(cell("Italiano")).toContainText("Carrello");
    await expect(row()).not.toContainText("Carrello cancellato");

    // Editing the German base inline flags the other languages for review.
    await cell("Deutsch").click();
    await input("Deutsch").fill("Warenkorb (inline)");
    await input("Deutsch").press("Enter");
    await saved();
    await expect(cell("Français")).toContainText("Prüfen");
  } finally {
    // Restore the seeded base texts for the specs that follow (shared server).
    await page.goto("/admin/translations?q=shop.cart.title").catch(() => {});
    if (await row().isVisible().catch(() => false)) {
      await cell("Deutsch").click();
      await input("Deutsch").fill("Warenkorb");
      await input("Deutsch").press("Enter");
      await saved();
      await cell("Français").click();
      await input("Français").fill("Panier");
      await input("Français").press("Enter");
      await saved();
    }
  }
});
