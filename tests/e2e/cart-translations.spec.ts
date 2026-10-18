import { expect, test, type Page } from "@playwright/test";

// Issue #58 step 3 (slice) — the cart flow reads its texts from the translation table.
// The empty state, the drawer, the summary, the quantity/remove aria labels, the free
// shipping sentence and the discount field answer in the request language; German
// stays the base. Fails on the pre-change build, where all of it was hard-coded German.

interface ApiVariant {
  sku: string;
  label: string;
  stock: number;
  priceDeltaCents: number;
}
interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  images: { src: string }[];
  variants: ApiVariant[];
}

async function seedCart(page: Page): Promise<void> {
  const response = await page.request.get("/api/products");
  const body = (await response.json()) as { items: ApiProduct[] };
  const product = body.items.find((item) => item.variants.some((v) => v.stock > 0))!;
  const variant = product.variants.find((v) => v.stock > 0)!;
  const line = {
    productId: product.id,
    slug: product.slug,
    sku: variant.sku,
    name: product.name,
    variantLabel: variant.label,
    imageSrc: product.images[0]?.src ?? "",
    unitPriceCents: product.priceCents + variant.priceDeltaCents,
    qty: 1,
    stock: variant.stock,
  };
  await page.goto("/fr/products");
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    ["cart:v1", JSON.stringify({ v: 1, lines: [line] })] as const,
  );
}

test("the empty French cart page answers in French", async ({ page }) => {
  await page.goto("/fr/cart");
  await expect(
    page.getByRole("heading", { level: 1, name: "Votre panier est vide" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Continuer vos achats" })).toBeVisible();
  await expect(page.getByText("Ihr Warenkorb ist leer")).toHaveCount(0);
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
  await page.locator("header").getByRole("button", { name: /Warenkorb/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Panier" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(drawer.getByText("Sous-total")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Passer à la caisse" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: /^Retirer :/ })).toBeVisible();
});
