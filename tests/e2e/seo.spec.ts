import { expect, test } from "@playwright/test";

// Issue #28 — real 404s, real titles, complete structured data.

test("an unknown product answers with a real HTTP 404", async ({ page }) => {
  const response = await page.request.get("/produkt/gibts-nicht");
  expect(response.status()).toBe(404);
});

test("a known product answers 200 and is titled by its real name", async ({ page }) => {
  const response = await page.request.get("/api/products");
  const body = (await response.json()) as {
    items: { slug: string; name: string }[];
  };
  const product = body.items[0];
  const pageResponse = await page.request.get(`/produkt/${product.slug}`);
  expect(pageResponse.status()).toBe(200);
  const html = await pageResponse.text();
  // The real name ("Nike Revolution"), not the de-slugged URL with index suffix.
  expect(html).toContain(`<title>${product.name} | coder-shop</title>`);
  expect(html).not.toContain(`<title>${product.slug.replace(/-/g, " ")}`);
});

test("JSON-LD carries absolute images, offer urls and a BreadcrumbList", async ({ page }) => {
  const response = await page.request.get("/api/products");
  const body = (await response.json()) as { items: { slug: string }[] };
  const html = await (await page.request.get(`/produkt/${body.items[0].slug}`)).text();
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(match, "product page must embed JSON-LD").not.toBeNull();
  const json = JSON.parse(match![1].replace(/\\u003c/g, "<"));
  expect(json["@context"]).toBe("https://schema.org");
  const graph = json["@graph"] as Record<string, unknown>[];
  const product = graph.find((entry) => entry["@type"] === "Product")!;
  const breadcrumbs = graph.find((entry) => entry["@type"] === "BreadcrumbList");
  expect(product).toBeDefined();
  expect(breadcrumbs).toBeDefined();

  const images = product.image as string[];
  expect(images.length).toBeGreaterThan(0);
  for (const image of images) expect(image).toMatch(/^https?:\/\//);

  const offers = product.offers as Record<string, string>[];
  expect(offers.length).toBeGreaterThan(0);
  for (const offer of offers) expect(offer.url).toMatch(/^https?:\/\//);

  const items = (breadcrumbs!.itemListElement as Record<string, unknown>[]) ?? [];
  expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
});
