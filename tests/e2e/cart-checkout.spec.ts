import { expect, test, type Page } from "@playwright/test";

// Issue #27 — cart and checkout rough edges.

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

async function seedCart(page: Page): Promise<ApiProduct> {
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
  await page.goto("/");
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    ["cart:v1", JSON.stringify({ v: 1, lines: [line] })] as const,
  );
  return product;
}

test("reloading /cart with items never flashes the empty state", async ({ page }) => {
  await seedCart(page);
  // Record whether the empty-state text is ever in the DOM during load/hydration.
  await page.addInitScript(() => {
    (window as unknown as { __sawEmpty: boolean }).__sawEmpty = false;
    const check = () => {
      const w = window as unknown as { __sawEmpty: boolean };
      if (document.body?.textContent?.includes("Ihr Warenkorb ist leer")) w.__sawEmpty = true;
    };
    new MutationObserver(check).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Warenkorb" })).toBeVisible();
  await expect(page.locator("main li").first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sawEmpty: boolean }).__sawEmpty)).toBe(
    false,
  );
});

test("reloading /checkout with items never flashes the empty state and has one <h1>", async ({
  page,
}) => {
  await seedCart(page);
  await page.addInitScript(() => {
    (window as unknown as { __sawEmpty: boolean }).__sawEmpty = false;
    const check = () => {
      const w = window as unknown as { __sawEmpty: boolean };
      if (document.body?.textContent?.includes("Es gibt nichts zu bezahlen")) w.__sawEmpty = true;
    };
    new MutationObserver(check).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await page.goto("/checkout");
  await expect(page.getByRole("button", { name: /Jetzt kaufen/ })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sawEmpty: boolean }).__sawEmpty)).toBe(
    false,
  );
  await expect(page.locator("h1")).toHaveCount(1);
});

test("empty /checkout keeps a single <h1>", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "Kasse" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("the drawer's „Zur Kasse“ goes to the checkout", async ({ page }) => {
  await seedCart(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Warenkorb, 1 Artikel/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Zur Kasse" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("mock card fields are not part of the submitted form", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");
  await expect(page.getByRole("button", { name: /Jetzt kaufen/ })).toBeVisible();
  for (const id of ["cardName", "cardNumber", "cardExpiry", "cardCvc"]) {
    await expect(page.locator(`#${id}`)).not.toHaveAttribute("name");
  }
});
