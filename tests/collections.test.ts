import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProductModel } from "@/models/product";
import { deriveFilter } from "@/lib/facets";
import { buildListingFilter, getCollectionProducts, listProducts } from "@/server/search";
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
