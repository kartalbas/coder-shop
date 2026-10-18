import { expect, test, type Page } from "@playwright/test";

// Issue #58 step 3 (slice) — the browse flow reads its texts from the translation
// table: listing (heading, sort, pagination, empty state), product cards, product page
// (breadcrumbs, price, variant picker, gallery, accordion, related, reviews) and the
// skip link answer in the request language; German stays the base. Fails on the
// pre-change build, where all of it was hard-coded German.

interface ApiVariant {
  label: string;
  stock: number;
  attributes: { storage?: number };
}
interface ApiProduct {
  slug: string;
  name: string;
  images: unknown[];
  variants: ApiVariant[];
}

async function findSellableMultiStorageProduct(page: Page): Promise<ApiProduct> {
  const response = await page.request.get("/api/products?type=smartphone&brand=Apple");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: ApiProduct[] };
  const product = body.items.find(
    (item) =>
      new Set(item.variants.map((v) => v.attributes.storage)).size >= 2 &&
      item.variants.some((v) => v.stock > 0) &&
      item.images.length >= 2,
  );
  expect(
    product,
    "seed must contain an Apple phone with ≥2 storages, ≥2 images and stock",
  ).toBeDefined();
  return product!;
}

// Choose a variant that has stock: the dimension values are catalog content (step 5),
// so the label parts are clicked as the dimension buttons (same as helpers.ts).
async function chooseSellableVariant(page: Page, product: ApiProduct): Promise<void> {
  const variant = product.variants.find((v) => v.stock > 0)!;
  for (const part of variant.label.split(" / ")) {
    await page.getByRole("button", { name: part, exact: true }).first().click();
  }
}

test("the French listing, cards, pagination and skip link are French", async ({ page }) => {
  await page.goto("/fr/products");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tous les produits" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Alle Produkte" })).toHaveCount(0);
  // Sort select and its options follow the language.
  const sort = page.getByRole("combobox", { name: "Trier" });
  await expect(sort).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sortierung" })).toHaveCount(0);
  await sort.click();
  await expect(page.getByRole("option", { name: "Prix croissant" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Preis aufsteigend" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // The facet sidebar's aria label and the brand group caption are translated.
  await expect(page.getByRole("complementary", { name: "Filtres" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Marque" })).toBeVisible();
  // Cards show the "from" price prefix in French (fr-CH puts CHF behind the amount).
  await expect(page.getByText(/^dès \d/).first()).toBeVisible();
  // Pagination (200 seeded products, 24 per page) is French.
  const nav = page.getByRole("navigation", { name: "Pages" });
  await expect(nav).toBeVisible();
  await expect(nav.getByText(/Affichage 1–24 sur/)).toBeVisible();
  await expect(nav.getByRole("button", { name: "Suivant" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Weiter" })).toHaveCount(0);
  // The skip link follows the language too.
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeAttached();
});

test("the French product page answers in French", async ({ page }) => {
  const target = await findSellableMultiStorageProduct(page);
  await page.goto(`/fr/products/${target.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: target.name })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("navigation").getByRole("link", { name: "Accueil" })).toBeVisible();
  // The price carries the French "from" prefix and the French VAT note.
  await expect(page.getByText(/^dès \d/).first()).toBeVisible();
  await expect(page.getByText(/incluse\./).first()).toBeVisible();
  // The disabled add-to-cart names the missing dimensions with the French sentence
  // (the dimension labels themselves are catalog content — step 5).
  await expect(page.getByRole("button", { name: /Veuillez choisir/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "In den Warenkorb" })).toHaveCount(0);
  await chooseSellableVariant(page, target);
  await expect(page.getByRole("button", { name: "Ajouter au panier" })).toBeEnabled();
  // Gallery arrows and the accordion are French (the arrows only appear on
  // hover/focus — the a11y spec covers that; here the label is what matters).
  await expect(page.getByRole("button", { name: "Image précédente" })).toBeAttached();
  await expect(page.getByRole("button", { name: /^Image 2 sur/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Description" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Détails et variantes" })).toBeVisible();
  // Reviews and the related rail are French.
  await expect(page.getByRole("heading", { name: "Avis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bewertungen" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Produits similaires" })).toBeVisible();
});

test("the Spanish listing and product page answer in Spanish", async ({ page }) => {
  await page.goto("/es/products");
  await expect(
    page.getByRole("heading", { level: 1, name: "Todos los productos" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("combobox", { name: "Ordenar" })).toBeVisible();
  const target = await findSellableMultiStorageProduct(page);
  await page.goto(`/es/products/${target.slug}`);
  await expect(page.getByRole("button", { name: /Seleccione/ })).toBeDisabled();
  await chooseSellableVariant(page, target);
  await expect(page.getByRole("button", { name: "Añadir a la cesta" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Valoraciones" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inicio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Imagen anterior" })).toBeAttached();
});
