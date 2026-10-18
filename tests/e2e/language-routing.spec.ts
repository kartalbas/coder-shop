import { expect, test } from "@playwright/test";

// Issue #58 step 2 — language-prefix routing, switcher and hreflang. The language is the
// first URL segment, the path itself stays English in every language (#63); the proxy
// resolves the language (prefix > cookie > browser), the switcher iterates the language
// rows and hreflang alternates cover every active language plus x-default.

test("the browser language picks the prefix and the page is lang-tagged", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "fr-CH" });
  const page = await context.newPage();
  await page.goto("/products");
  await expect(page).toHaveURL(/\/fr\/products$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await context.close();
});

test("the base language answers on the prefix-free URLs without a redirect (#65)", async ({
  request,
}) => {
  for (const path of ["/", "/products"]) {
    const response = await request.get(path, { maxRedirects: 0, failOnStatusCode: false });
    expect(response.status(), `${path} answers directly`).toBe(200);
  }
  const html = await (await request.get("/products")).text();
  expect(html).toContain('href="/products/');
});

test("hreflang lists every active language and x-default for the same path", async ({
  request,
}) => {
  const html = await (await request.get("/de/products")).text();
  for (const code of ["de", "fr", "it", "rm", "es"]) {
    expect(html, `hreflang ${code}`).toMatch(
      new RegExp(
        `<link[^>]*rel="alternate"[^>]*hreflang="${code}"[^>]*href="[^"]*/${code}/products"`,
        "i",
      ),
    );
  }
  expect(html).toMatch(/<link[^>]*hreflang="x-default"/i);
});

test("the switcher keeps the page, the query and the remembered choice", async ({ page }) => {
  await page.goto("/de/products?type=shoes");
  const switcher = page.getByRole("navigation", { name: "Sprache" });
  await expect(switcher.getByRole("link", { name: "fr" })).toBeVisible();
  await switcher.getByRole("link", { name: "fr" }).click();
  await expect(page).toHaveURL(/\/fr\/products\?type=shoes$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  // The proxy wrote the choice — a prefix-free visit now lands on French too.
  await page.goto("/products");
  await expect(page).toHaveURL(/\/fr\/products$/);
});

test("every language serves the full listing", async ({ request }) => {
  for (const code of ["de", "fr", "it", "rm", "es"]) {
    const response = await request.get(`/${code}/products`);
    expect(response.status(), `${code} listing`).toBe(200);
    const html = await response.text();
    // Product links are English paths (#63); the proxy localizes them on navigation.
    expect(html, `${code} listing links products`).toContain('href="/products/');
  }
});

test("an unknown product still answers a real 404 behind the prefix", async ({ request }) => {
  const response = await request.get("/de/products/gibts-nicht");
  expect(response.status()).toBe(404);
});
