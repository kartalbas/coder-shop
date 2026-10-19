import { expect, test, type Page } from "@playwright/test";
import { firstThreePerTypeBySlug } from "../../scripts/seed/demo-content";
import { productContentKeys } from "../../src/lib/i18n";
import translationsJson from "../../src/server/translations.json";
import { loginAsAdmin } from "./helpers";
import { E2E_PORT } from "./playwright.config";

// Issue #58 step B2: the admin edits the per-language product content where the
// content lives — the product form's translation section writes through the one
// table, and the storefront answers in the request language on the next request.
// Nothing is hard-coded: the product and the restore values are derived from the
// seed's own generator and the seed file, exactly the data the server was seeded
// from. Every edit is restored at the end — the specs share one server.

interface Row {
  key: string;
  de: string;
  texts: Record<string, string>;
}

const rows = translationsJson as Row[];
const rowFor = (key: string): Row => rows.find((row) => row.key === key)!;

const demo = firstThreePerTypeBySlug();
const product = demo.find((candidate) => {
  const row = rowFor(productContentKeys(candidate.slug).name);
  return row.texts.fr !== candidate.name;
})!;
const keys = productContentKeys(product.slug);
const originalName = rowFor(keys.name).texts.fr;
const originalDescription = rowFor(keys.description).texts.fr;

// The admin follows the shared `lang` cookie, and visiting `/fr/…` above remembers
// French — the editor labels are asserted in German, so the cookie is pinned first.
async function pinGermanAdmin(page: Page): Promise<void> {
  await page.context().addCookies([{ name: "lang", value: "de", url: `http://127.0.0.1:${E2E_PORT}/` }]);
}

// The admin list searches name, brand and SKU — the editor is opened through the
// search result; the row's aria-label carries the (possibly renamed) name, so the
// link itself is matched.
async function openProductEditor(page: Page, query: string): Promise<void> {
  await pinGermanAdmin(page);
  await page.goto(`/admin/products?q=${encodeURIComponent(query)}`);
  const link = page.getByRole("link", { name: "Bearbeiten" }).first();
  await expect(link).toBeVisible();
  await link.click();
}

async function saveFrench(page: Page, name: string, description: string): Promise<void> {
  await openProductEditor(page, product.name);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(product.name);
  const section = page.getByRole("region", { name: "Übersetzungen" });
  await expect(section).toBeVisible();
  await section.locator("#content-fr-name").fill(name);
  await section.locator("#content-fr-description").fill(description);
  await section.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Übersetzungen gespeichert")).toBeVisible();
}

test("admin edits the French product content on the product form — /fr follows", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  const editedName = `Nom français vérifié ${Date.now()}`;
  const editedDescription = `Description française vérifiée ${Date.now()}.`;
  try {
    await saveFrench(page, editedName, editedDescription);

    await page.goto(`/fr/products/${product.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(editedName, {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Description", exact: true }).click();
    await expect(page.getByText(editedDescription, { exact: true })).toBeVisible();
    // The German document text is gone, not just hidden behind the French one.
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(product.name);
  } finally {
    await saveFrench(page, originalName, originalDescription).catch(() => undefined);
  }

  await page.goto(`/fr/products/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(originalName, {
    timeout: 30_000,
  });
});

test("renaming the German product on the form follows the row — other languages stay and flag", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);

  const editedGerman = `Umbenannt ${Date.now()}`;
  try {
    // Rename through the core form — the content row's German base must follow
    // automatically (the document is the German truth), no manual row edit.
    await openProductEditor(page, product.name);
    const core = page.getByRole("region", { name: "Stammdaten" });
    await core.locator("input[name='name']").fill(editedGerman);
    await core.getByRole("button", { name: "Speichern" }).click();

    // The French page keeps the French name — the rename only moved the base.
    await page.goto(`/fr/products/${product.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(originalName, {
      timeout: 30_000,
    });
    // The translations editor shows the row with the new German base.
    await page.goto("/admin/translations/catalog.product." + product.slug + ".name");
    await expect(page.locator("#translation-de")).toHaveValue(editedGerman);
  } finally {
    // The rename moved the name — the restore finds the row under the new one.
    await openProductEditor(page, editedGerman).catch(() => undefined);
    const core = page.getByRole("region", { name: "Stammdaten" });
    await core.locator("input[name='name']").fill(product.name).catch(() => undefined);
    await core.getByRole("button", { name: "Speichern" }).click().catch(() => undefined);
  }
});
