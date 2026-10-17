import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProductModel } from "@/models/product";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";
import { escapeRegex } from "@/lib/regex";
import { listProducts, searchProducts } from "@/server/search";
import { deriveFilter } from "@/lib/facets";
import { listingParamsSchema } from "@/lib/validations/listing";

function phoneData(index: number) {
  const priceCents = 10000 + index * 100;
  return {
    slug: `test-phone-${String(index).padStart(3, "0")}`,
    name: `iPhone Test ${index}`,
    description: "Test-Smartphone.",
    type: "smartphone" as const,
    brand: "Apple",
    priceCents,
    images: [{ src: `/products/test-phone-${index}-1.svg`, alt: "Test" }],
    featured: false,
    filter: deriveFilter([{ attributes: { color: "schwarz", storage: 128 } }]),
    variants: [
      {
        sku: `TP-${index}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock: 10,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  };
}

function shoeData(index: number, size: string) {
  return {
    slug: `test-shoe-${size}-${index}`,
    name: `Test Schuh ${size} ${index}`,
    description: "Test-Schuh.",
    type: "shoes" as const,
    brand: "Nike",
    priceCents: 8000 + index * 100,
    images: [{ src: `/products/test-shoe-${index}-1.svg`, alt: "Test" }],
    featured: false,
    filter: deriveFilter([{ attributes: { color: "blau", size } }]),
    variants: [
      {
        sku: `TS-${size}-${index}`,
        label: `${size} / blau`,
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 2,
        weightGrams: 600,
        attributes: { color: "blau", size },
      },
    ],
  };
}

describe("storefront queries", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await ProductModel.insertMany([
      ...Array.from({ length: 30 }, (_, i) => phoneData(i)),
      ...Array.from({ length: 5 }, (_, i) => shoeData(i, "42")),
      ...Array.from({ length: 3 }, (_, i) => shoeData(i, "43")),
    ]);
  });

  afterAll(disconnectTestDB);

  it("filters by type and size", async () => {
    const result = await listProducts({ type: "shoes", size: ["42"] });
    expect(result.total).toBe(5);
    for (const item of result.items) {
      expect(item.type).toBe("shoes");
      expect(item.filter.sizes).toContain("42");
    }
  });

  it("filters by brand and sorts price-asc with stable pages", async () => {
    const page1 = await listProducts({ type: "smartphone", brand: ["Apple"], sort: "price-asc" });
    expect(page1.total).toBe(30);
    expect(page1.items).toHaveLength(24);
    const prices = page1.items.map((p) => p.priceCents);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);

    const page2 = await listProducts({ type: "smartphone", brand: ["Apple"], sort: "price-asc", page: 2 });
    expect(page2.items).toHaveLength(6);
    expect(page2.items[0].priceCents).toBe(prices[23] + 100);
  });

  it("clamps page beyond the last page", async () => {
    const result = await listProducts({ type: "smartphone", page: 99 });
    expect(result.page).toBe(2);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("returns facet counts for the type-filtered set", async () => {
    const result = await listProducts({ type: "shoes" });
    const size42 = result.facets.sizes.find((f) => f.value === "42");
    expect(size42?.count).toBe(5);
  });

  it("filters several values per facet (issue #24)", async () => {
    const result = await listProducts({ type: "shoes", size: ["42", "43"] });
    expect(result.total).toBe(8);
    const brands = await listProducts({ type: "shoes", brand: ["Nike", "Adidas"] });
    expect(brands.total).toBe(8);
  });

  it("counts each facet over the other active filters, excluding its own (issue #24)", async () => {
    const result = await listProducts({ type: "shoes", size: ["42"] });
    // own facet keeps all values with their counts (43 stays selectable)…
    expect(result.facets.sizes.find((f) => f.value === "42")?.count).toBe(5);
    expect(result.facets.sizes.find((f) => f.value === "43")?.count).toBe(3);
    // …while other facets reflect the active size filter.
    expect(result.facets.brand.find((f) => f.value === "Nike")?.count).toBe(5);
  });

  it("parses comma-separated facet params into lists (issue #24)", () => {
    expect(
      listingParamsSchema.parse({ brand: "Apple,Samsung", size: ["42", "43,44"], storage: "128,256" }),
    ).toEqual({ brand: ["Apple", "Samsung"], size: ["42", "43", "44"], storage: [128, 256] });
    expect(listingParamsSchema.parse({ brand: "Apple, Apple, " })).toEqual({
      brand: ["Apple"],
    });
    expect(listingParamsSchema.parse({})).toEqual({});
  });

  it("maps documents to plain DTOs", async () => {
    const result = await listProducts({ type: "smartphone", pageSize: 1 });
    const item = result.items[0];
    expect(typeof item.id).toBe("string");
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(item.variants[0].attributes.color).toBe("schwarz");
  });

  it("search returns at most 8 literal-prefix hits", async () => {
    const hits = await searchProducts("iphone");
    expect(hits.length).toBeLessThanOrEqual(8);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.name.toLowerCase()).toMatch(/(?:^|\b)iphone/i);
    }
    expect(await searchProducts("")).toEqual([]);
  });

  it("search matches a literal prefix at any word boundary", async () => {
    const hits = await searchProducts("schuh");
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.name.toLowerCase()).toContain("schuh");
    }
  });

  it("escapes regex metacharacters in search input", () => {
    expect(escapeRegex("a.*b+c")).toBe("a\\.\\*b\\+c");
  });
});
