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

// Hermetic: the free-shipping assertion below expects the *locked* bar, so the seeded
// line must stay below the configured threshold — read from /api/shop-settings (data,
// never a hard-coded price) and cheapest-first, so earlier specs consuming stock or the
// admin editing the threshold can never flip the bar out from under the assertion.
async function seedCart(page: Page): Promise<void> {
  const settings = (await (await page.request.get("/api/shop-settings")).json()) as {
    freeShippingFromCents: number;
  };
  const response = await page.request.get("/api/products?sort=price-asc");
  const body = (await response.json()) as { items: ApiProduct[] };
  const candidate = body.items
    .flatMap((item) =>
      item.variants
        .filter((v) => v.stock > 0)
        .map((variant) => ({
          product: item,
          variant,
          unitPriceCents: item.priceCents + variant.priceDeltaCents,
        })),
    )
    .find((entry) => entry.unitPriceCents < settings.freeShippingFromCents)!;
  const product = candidate.product;
  const variant = candidate.variant;
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
