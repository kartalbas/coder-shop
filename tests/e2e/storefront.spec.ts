import { expect, test, type Page } from "@playwright/test";

interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  images: unknown[];
  variants: { sku: string; attributes: { storage?: number } }[];
}

async function findTestProduct(page: Page): Promise<ApiProduct> {
  const response = await page.request.get("/api/products?type=smartphone&brand=Apple");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { items: ApiProduct[] };
  const product = body.items.find(
    (item) =>
      new Set(item.variants.map((v) => v.attributes.storage)).size >= 2 &&
      item.images.length >= 2,
  );
  expect(product, "seed must contain an Apple phone with ≥2 storages and ≥2 images").toBeDefined();
  return product!;
}

test("browse → filter → product page → cart → checkout → confirmation", async ({ page }) => {
  test.setTimeout(150_000);

  // Browse the home page.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Technik, Style und Komfort/ }),
  ).toBeVisible();

  // Listing with a faceted filter (brand checkbox in the sidebar).
  await page.goto("/produkte?type=smartphone");
  const sidebar = page.getByRole("complementary", { name: "Filter" });
  await expect(sidebar).toBeVisible();
  // The checkbox is controlled by the URL (router.replace), so click and wait for the
  // async navigation instead of using check()'s synchronous state assertion.
  const appleCheckbox = sidebar.getByRole("checkbox", { name: "Apple" });
  await appleCheckbox.click();
  await expect(page).toHaveURL(/brand=Apple/);
  await expect(appleCheckbox).toHaveAttribute("aria-checked", "true");
  const productLinks = page.locator('main a[href^="/produkt/"]');
  await expect(productLinks.first()).toBeVisible();
  expect(await productLinks.count()).toBeGreaterThan(0);

  // Product page picked so the gallery and variant assertions are deterministic.
  const target = await findTestProduct(page);
  await page.goto(`/produkt/${target.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(target.name);

  // Gallery: main image plus working thumbnail navigation. Whether the slot's photo
  // file exists (loaded <img>) or not (placeholder) it carries the slot's German alt
  // as accessible name.
  // The gallery renders before the related-products rail, so the first match is the
  // main image (related cards only ever show their slot 1, never "Ansicht 2").
  await expect(page.getByRole("img", { name: /Ansicht 1/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Bild 2 von/ }).click();
  await expect(page.getByRole("img", { name: `${target.name} – Ansicht 2` })).toBeVisible();

  // Variant picker: a different storage updates the price.
  const priceBefore = await page.locator("main p.text-2xl").first().innerText();
  const storageChips = page.getByRole("group", { name: /Speicher/ }).locator("button");
  const secondChip = storageChips.nth(1);
  await secondChip.click();
  await expect(secondChip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main p.text-2xl").first()).not.toHaveText(priceBefore);

  // Add to cart → drawer opens with the line.
  await page.getByRole("button", { name: "In den Warenkorb" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(target.name)).toBeVisible();
  await page.keyboard.press("Escape");

  // Cart page shows the line, then continue to checkout.
  await page.goto("/warenkorb");
  await expect(page.getByRole("heading", { name: "Warenkorb" })).toBeVisible();
  await expect(page.getByText(target.name)).toBeVisible();
  await page.getByRole("link", { name: "Zur Kasse" }).click();
  await expect(page).toHaveURL(/\/kasse/);

  // Checkout: address, shipping, mock payment.
  await page.fill("#name", "Erika Test");
  await page.fill("#email", "erika.test@example.ch");
  await page.fill("#phone", "079 555 12 34");
  await page.fill("#street", "Teststrasse 7");
  await page.fill("#postalCode", "8001");
  await page.fill("#city", "Zürich");
  await page.getByRole("button", { name: /Jetzt kaufen/ }).click();

  // Confirmation with the order number.
  await expect(page).toHaveURL(/\/bestellung\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  const orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
  await expect(page.getByText("Vielen Dank für Ihre Bestellung!")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(orderNumber);
  await expect(page.getByText("Bezahlt").first()).toBeVisible();
  await expect(page.getByText(/8,1 % MwSt\. inbegriffen/)).toBeVisible();
});
