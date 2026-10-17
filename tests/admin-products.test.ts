import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProductModel, type Product } from "@/models/product";
import { getProductBySlug, listProducts } from "@/server/search";
import {
  getProductForAdmin,
  listProductsAdmin,
  toggleFeaturedCore,
  updateProductCore,
  updateVariantCore,
} from "@/server/products-admin";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

async function seedProduct(slug: string, brand: string, featured = false) {
  return ProductModel.create({
    slug,
    name: `Admin Test ${slug}`,
    description: "Produkt für Admin-Produkt-Tests.",
    type: "smartphone",
    brand,
    priceCents: 50000,
    images: [{ src: `/products/${slug}-1.svg`, alt: "Test" }],
    featured,
    filter: { colors: ["schwarz", "weiß"], sizes: [], storage: [128, 256], materials: [] },
    variants: [
      {
        sku: `AP-${slug}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
      {
        sku: `AP-${slug}-w`,
        label: "256 GB / weiß",
        priceDeltaCents: 4500,
        stock: 2,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "weiß", storage: 256 },
      },
    ],
  });
}

describe("admin product management", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedProduct("alpha", "Apple");
    await seedProduct("beta", "Samsung", true);
  });

  afterAll(disconnectTestDB);

  it("lists products with stock totals and searches by name, brand and sku", async () => {
    const all = await listProductsAdmin({});
    expect(all.total).toBe(2);
    expect(all.items[0].totalStock).toBe(7);

    const byName = await listProductsAdmin({ q: "alpha" });
    expect(byName.items.map((i) => i.slug)).toEqual(["alpha"]);

    const byBrand = await listProductsAdmin({ q: "sams" });
    expect(byBrand.items.map((i) => i.slug)).toEqual(["beta"]);

    const bySku = await listProductsAdmin({ q: "AP-beta-w" });
    expect(bySku.items.map((i) => i.slug)).toEqual(["beta"]);
  });

  it("escapes regex metacharacters in the admin search", async () => {
    const result = await listProductsAdmin({ q: "alpha.*beta" });
    expect(result.total).toBe(0);
  });

  it("updates core data and rejects invalid input", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const ok = await updateProductCore(product!._id.toString(), {
      name: "Neuer Name",
      description: "Eine völlig neue Beschreibung.",
      brand: "Apple",
      priceCents: 59900,
    });
    expect(ok.ok).toBe(true);
    const fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.name).toBe("Neuer Name");
    expect(fresh?.priceCents).toBe(59900);

    const bad = await updateProductCore(product!._id.toString(), {
      name: "x",
      description: "zu kurz",
      brand: "Apple",
      priceCents: -1,
    });
    expect(bad.ok).toBe(false);
  });

  it("recomputes the listing filter when a variant's colour changes (ARCHITECTURE §3)", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const result = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: 9,
      weightGrams: 210,
      attributes: { color: "blau", storage: 128 },
    });
    expect(result.ok).toBe(true);

    const fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.filter.colors).toEqual(["blau", "weiß"]);
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.stock).toBe(9);
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.label).toBe("128 GB / blau");

    const dto = await getProductBySlug("alpha");
    expect(dto?.filter.colors).toEqual(["blau", "weiß"]);

    const listing = await listProducts({ type: "smartphone", color: "blau" });
    expect(listing.items.map((i) => i.slug)).toContain("alpha");
    const facets = await listProducts({ type: "smartphone" });
    expect(facets.facets.colors.map((f) => f.value)).toContain("blau");
  });

  it("rejects an unknown sku and negative stock", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const unknown = await updateVariantCore(product!._id.toString(), "gibt-es-nicht", {
      priceDeltaCents: 0,
      stock: 1,
      weightGrams: 100,
      attributes: { color: "rot" },
    });
    expect(unknown.ok).toBe(false);

    const negative = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: -5,
      weightGrams: 100,
      attributes: { color: "blau", storage: 128 },
    });
    expect(negative.ok).toBe(false);
  });

  it("toggles featured", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    expect((await toggleFeaturedCore(product!._id.toString())).ok).toBe(true);
    expect((await ProductModel.findById(product!._id).lean<Product>().exec())?.featured).toBe(true);
    expect((await toggleFeaturedCore(product!._id.toString())).ok).toBe(true);
    expect((await ProductModel.findById(product!._id).lean<Product>().exec())?.featured).toBe(false);
  });

  it("getProductForAdmin returns null for unknown ids and a DTO for known ones", async () => {
    expect(await getProductForAdmin("000000000000000000000000")).toBeNull();
    expect(await getProductForAdmin("kein-object-id")).toBeNull();
    const product = await ProductModel.findOne({ slug: "beta" }).exec();
    const dto = await getProductForAdmin(product!._id.toString());
    expect(dto?.slug).toBe("beta");
  });
});
