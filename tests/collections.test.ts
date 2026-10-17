import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProductModel } from "@/models/product";
import { deriveFilter } from "@/lib/facets";
import {
  buildListingFilter,
  getCollectionProducts,
  listProducts,
  searchProducts,
} from "@/server/search";
import { listingParamsSchema } from "@/lib/validations/listing";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

async function seedProduct(slug: string, collection?: string) {
  const variants = [
    {
      sku: `COL-${slug}`,
      label: "42 / schwarz",
      priceDeltaCents: 0,
      stock: 5,
      weightGrams: 300,
      restockThreshold: 5,
      attributes: { color: "schwarz", size: "42" },
    },
  ];
  return ProductModel.create({
    slug,
    name: `Kollektion ${slug}`,
    description: "Test",
    type: "shoes",
    brand: "Nike",
    priceCents: 10000,
    images: [],
    collection,
    filter: deriveFilter(variants),
    variants,
  });
}

describe("collection filter (issue #23)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedProduct("neu", "Neuheiten");
    await seedProduct("sale", "Sale");
    await seedProduct("ohne");
  });

  afterAll(disconnectTestDB);

  it("buildListingFilter only adds collection when set", () => {
    expect(buildListingFilter({}).collection).toBeUndefined();
    expect(buildListingFilter({ collection: "Sale" }).collection).toBe("Sale");
  });

  it("the listing schema accepts the three collections and rejects junk", () => {
    expect(listingParamsSchema.safeParse({ collection: "Neuheiten" }).success).toBe(true);
    expect(listingParamsSchema.safeParse({ collection: "Quatsch" }).success).toBe(false);
  });

  it("listProducts?collection returns exactly that collection", async () => {
    const result = await listProducts({ collection: "Neuheiten" });
    expect(result.items.map((i) => i.name)).toEqual(["Kollektion neu"]);
  });

  it("getCollectionProducts returns the collection's products", async () => {
    const sale = await getCollectionProducts("Sale", 4);
    expect(sale.map((p) => p.name)).toEqual(["Kollektion sale"]);
    expect(await getCollectionProducts("Leere Sammlung", 4)).toEqual([]);
  });
});

describe("buyable listing prices (issue #20)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    const variants = [
      {
        sku: "PRICE-64",
        label: "64 GB",
        priceDeltaCents: 2000,
        stock: 5,
        weightGrams: 200,
        restockThreshold: 5,
        attributes: { color: "schwarz", storage: 64 },
      },
      {
        sku: "PRICE-256",
        label: "256 GB",
        priceDeltaCents: 4500,
        stock: 5,
        weightGrams: 200,
        restockThreshold: 5,
        attributes: { color: "schwarz", storage: 256 },
      },
    ];
    await ProductModel.create({
      slug: "pixel-9a",
      name: "Google Pixel 9a",
      description: "Test",
      type: "smartphone",
      brand: "Google",
      priceCents: 48400,
      images: [],
      filter: deriveFilter(variants),
      variants,
    });
  });

  afterAll(disconnectTestDB);

  it("the listing DTO carries the cheapest real price, flagged as „ab“", async () => {
    const result = await listProducts({});
    const item = result.items.find((i) => i.slug === "pixel-9a");
    expect(item?.minPriceCents).toBe(50400);
    expect(item?.priceFrom).toBe(true);
  });

  it("instant search never advertises the unreachable base price", async () => {
    const hits = await searchProducts("Pixel");
    expect(hits[0].priceCents).toBe(50400);
    expect(hits[0].priceFrom).toBe(true);
  });
});
