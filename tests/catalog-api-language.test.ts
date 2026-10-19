import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { ProductModel } from "@/models/product";
import { getProductsBySlugs, searchProducts } from "@/server/search";
import { getRequestLabels } from "@/server/i18n";
import { seedTranslations } from "../scripts/seed/seed";
import { firstThreePerTypeBySlug } from "../scripts/seed/demo-content";
import { productContentKeys } from "@/lib/i18n";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step B1b: the client-fetch APIs (/api/search, /api/recently-viewed) sit
// outside the proxy matcher, so they answer in the language the `lang` cookie remembers
// — the same getRequestLabels() precedence every server action uses. The mock plays the
// request scope (the request-language pattern); without a cookie the base answers.

const request = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (request.cookie ? { value: request.cookie } : undefined),
  }),
  headers: async () => ({ get: () => null }),
}));

// The demo product whose French name differs from the German base.
const demo = firstThreePerTypeBySlug().find((product) => {
  const row = DEFAULT_TRANSLATIONS.find(
    (candidate) => candidate.key === productContentKeys(product.slug).name,
  );
  return row !== undefined && row.texts.fr !== undefined && row.texts.fr !== product.name;
})!;

beforeAll(async () => {
  await connectTestDB();
  await clearCollections();
  await seedTranslations();
  await ProductModel.create({
    slug: demo.slug,
    name: demo.name,
    description: demo.description,
    type: demo.type,
    brand: demo.brand,
    priceCents: 10_000,
    images: [{ src: `/products/${demo.slug}-1.webp`, alt: "Demo" }],
    featured: false,
    filter: demo.filter,
    variants: [
      {
        sku: `API-${demo.slug}`,
        label: "Demo",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 400,
        attributes: {},
      },
    ],
  });
});

afterEach(() => {
  request.cookie = undefined;
});

afterAll(async () => {
  await clearCollections();
  await disconnectTestDB();
});

describe("client-fetch APIs answer the remembered language (#58 step B1b)", () => {
  it("the lang cookie makes search hits and recently-viewed items answer French", async () => {
    request.cookie = "fr";
    const labels = await getRequestLabels();
    const keys = productContentKeys(demo.slug);
    const [hits, items] = await Promise.all([
      searchProducts(demo.name.split(" ").slice(-2).join(" "), 8, labels),
      getProductsBySlugs([demo.slug], labels),
    ]);
    expect(labels[keys.name]).not.toBe(demo.name);
    expect(hits.some((hit) => hit.name === labels[keys.name])).toBe(true);
    expect(items[0]!.name).toBe(labels[keys.name]);
  });

  it("without a cookie the German base answers", async () => {
    const labels = await getRequestLabels();
    const items = await getProductsBySlugs([demo.slug], labels);
    expect(items[0]!.name).toBe(demo.name);
  });
});
