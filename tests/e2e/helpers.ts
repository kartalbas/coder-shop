import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@codershop.ch";
export const ADMIN_PASSWORD = "Admin!2026";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  // A failed login stays on /admin/login — only the exact dashboard URL counts.
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

// Put one sellable variant of the type into the cart: the API picks a variant that
// actually has stock (issue #62: serial-tracked stock is a handful of units and can
// be sold out), and the label parts are clicked as the dimension buttons.
export async function addSellableVariantToCart(page: Page, type: string): Promise<void> {
  const response = await page.request.get(`/api/products?type=${type}&sort=price-asc`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    items: { slug: string; variants: { label: string; stock: number }[] }[];
  };
  const target = body.items
    .flatMap((item) => item.variants.filter((v) => v.stock > 0).map((v) => ({ slug: item.slug, variant: v })))
    .find((entry) => entry.variant.label.length > 0);
  expect(target, `the catalog must contain a sellable ${type}`).toBeDefined();
  await page.goto(`/products/${target!.slug}`);
  for (const part of target!.variant.label.split(" / ")) {
    await page.getByRole("button", { name: part, exact: true }).first().click();
  }
  await expect(page.getByRole("button", { name: "In den Warenkorb" })).toBeEnabled();
  await page.getByRole("button", { name: "In den Warenkorb" }).click();
}

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

// Put one cheap, sellable line into the persisted cart. Hermetic for free-shipping
// assertions: the unit price stays below the configured threshold — read from
// /api/shop-settings (data, never a hard-coded price) and cheapest-first — so earlier
// specs consuming stock can never flip a locked free-shipping bar out from under an
// assertion. (#58: extracted from cart-translations.spec.ts for reuse.)
// `qty` sizes the line (with matching stock) so a spec can order twice and still get
// two distinct orders — the idempotent checkout (#15) answers identical submits with
// the same order.
export async function seedCart(
  page: Page,
  gotoPath = "/fr/products",
  qty = 1,
): Promise<void> {
  const settings = (await (await page.request.get("/api/shop-settings")).json()) as {
    freeShippingFromCents: number;
  };
  const response = await page.request.get("/api/products?sort=price-asc");
  const body = (await response.json()) as { items: ApiProduct[] };
  const candidate = body.items
    .flatMap((item) =>
      item.variants
        .filter((v) => v.stock >= qty)
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
    qty,
    stock: variant.stock,
  };
  await page.goto(gotoPath);
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    ["cart:v1", JSON.stringify({ v: 1, lines: [line] })] as const,
  );
}

export async function readStockOfSku(page: Page, sku: string): Promise<number> {
  await page.goto(`/admin/products?q=${encodeURIComponent(sku)}`);
  // The SKU search is exact, so the single result row is the product of that SKU.
  const row = page.locator("tbody tr").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const stockText = await row.locator("td").nth(5).innerText();
  return Number(stockText.trim());
}
