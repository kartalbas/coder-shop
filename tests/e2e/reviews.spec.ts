import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const EMAIL = "bewerterin@example.ch";
const PASSWORD = "Bewerten123!";

async function buyOneProduct(page: Page): Promise<string> {
  const response = await page.request.get("/api/products?type=shoes");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    items: {
      slug: string;
      variants: { stock: number; attributes: { color?: string; size?: string; storage?: number } }[];
    }[];
  };
  // A variant that is actually in stock — the first chip is not necessarily buyable.
  const product = body.items.find((item) => item.variants.some((v) => v.stock > 0));
  expect(product).toBeDefined();
  const variant = product!.variants.find((v) => v.stock > 0)!;

  await page.goto(`/products/${product!.slug}`);
  const dims = variant.attributes;
  if (dims.color !== undefined) {
    await page.getByRole("group", { name: "Farbe" }).getByRole("button", { name: dims.color, exact: true }).click();
  }
  if (dims.size !== undefined) {
    await page.getByRole("group", { name: "Grösse" }).getByRole("button", { name: dims.size, exact: true }).click();
  }
  if (dims.storage !== undefined) {
    await page.getByRole("group", { name: "Speicher" }).getByRole("button", { name: `${dims.storage} GB`, exact: true }).click();
  }
  await page.getByRole("button", { name: "In den Warenkorb" }).click();

  await page.goto("/checkout");
  await expect(page.locator("#email")).toHaveValue(EMAIL, { timeout: 30_000 });
  await page.fill("#phone", "079 555 22 22");
  await page.fill("#street", "Bewertungsweg 1");
  await page.fill("#postalCode", "8004");
  await page.fill("#city", "Zürich");
  await page.getByRole("button", { name: /Jetzt kaufen/ }).click();
  await expect(page).toHaveURL(/\/orders\/B-\d{4}-\d{6}$/, { timeout: 30_000 });
  return product!.slug;
}

test("buyer reviews → moderation → published with verified badge and average (issue #47)", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);

  // Register and buy a product.
  await page.goto("/account/register");
  await page.fill("#name", "Bewertende Person");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("checkbox", { name: /AGB/ }).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  const slug = await buyOneProduct(page);

  // The buyer sees the review form on the product page and submits 5 stars.
  await page.goto(`/products/${slug}`);
  const form = page.getByRole("form", { name: "Produkt bewerten" });
  await expect(form).toBeVisible({ timeout: 30_000 });
  // Click the star's label (the visible target) — it activates the sr-only radio.
  await form.locator("label:has(input[aria-label='5 von 5 Sternen'])").click();
  await form.getByRole("textbox", { name: "Ihre Bewertung" }).fill(
    "Toller Schuh, sitzt perfekt und sieht gut aus.",
  );
  await form.getByRole("button", { name: "Bewertung absenden" }).click();
  await expect(page.getByRole("status").filter({ hasText: "freigeschaltet" })).toBeVisible({
    timeout: 30_000,
  });

  // Not public yet: the moderation queue holds it as pending.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bewertungen" })).toBeVisible();
  await expect(page.getByText("Toller Schuh, sitzt perfekt")).toHaveCount(0);

  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto("/admin/reviews?status=pending");
  const queueRow = adminPage.getByRole("listitem").filter({ hasText: "Toller Schuh" });
  await expect(queueRow).toBeVisible({ timeout: 30_000 });
  await queueRow.getByRole("button", { name: "Freigeben" }).click();
  // Approved → the row leaves the pending queue.
  await expect(queueRow).toBeHidden({ timeout: 30_000 });

  // Answer it as the shop.
  await adminPage.goto("/admin/reviews?status=approved");
  const approvedRow = adminPage.getByRole("listitem").filter({ hasText: "Toller Schuh" });
  await expect(approvedRow).toBeVisible({ timeout: 30_000 });
  await approvedRow.getByRole("textbox", { name: "Antworttext" }).fill("Vielen Dank für Ihre Bewertung!");
  await approvedRow.getByRole("button", { name: "Antworten" }).click();
  await expect(approvedRow.getByText("Vielen Dank für Ihre Bewertung!")).toBeVisible({
    timeout: 30_000,
  });

  // Published on the product page: average, verified badge, body and the answer.
  await page.goto(`/products/${slug}`);
  const section = page.getByRole("region", { name: "Bewertungen" });
  await expect(section.getByText("Toller Schuh, sitzt perfekt")).toBeVisible({ timeout: 30_000 });
  await expect(section.getByText("Verifizierter Kauf")).toBeVisible();
  await expect(section.getByText("5", { exact: true }).first()).toBeVisible();
  await expect(section.getByText("Antwort vom coder-shop")).toBeVisible();

  // JSON-LD carries the aggregate rating.
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  expect(jsonLd).toContain("AggregateRating");

  // The buyer cannot review the same product twice — the form is gone.
  await expect(
    page.getByRole("button", { name: "Bewertung absenden" }),
  ).toHaveCount(0);

  await admin.close();
});

test("non-buyers get no review form (issue #47)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/account/register");
  await page.fill("#name", "Nichtkäuferin");
  await page.fill("#email", "nichtkaeuferin@example.ch");
  await page.fill("#password", PASSWORD);
  await page.getByRole("checkbox", { name: /AGB/ }).check();
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  const response = await page.request.get("/api/products?type=clothing");
  const body = (await response.json()) as { items: { slug: string }[] };
  await page.goto(`/products/${body.items[0]!.slug}`);
  await expect(page.getByRole("heading", { name: "Bewertungen" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bewertung absenden" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Bewertungen können nur Kundinnen und Kunden schreiben"),
  ).toBeVisible();
});
