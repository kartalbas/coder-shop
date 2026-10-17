import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProductModel, type Product } from "@/models/product";
import { getProductBySlug, listProducts } from "@/server/search";
import {
  getProductForAdmin,
  listProductsAdmin,
  toggleFeaturedCore,
  updateImagesCore,
  updateProductCore,
  updateVariantCore,
} from "@/server/products-admin";
import { adminProductsQuerySchema } from "@/lib/validations/listing";
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
      expectedStock: 5,
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
      expectedStock: 1,
      weightGrams: 100,
      attributes: { color: "rot" },
    });
    expect(unknown.ok).toBe(false);

    const negative = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: -5,
      expectedStock: 9,
      weightGrams: 100,
      attributes: { color: "blau", storage: 128 },
    });
    expect(negative.ok).toBe(false);
  });

  it("does not overwrite stock that changed while the editor was open (issue #13)", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const id = product!._id.toString();
    // editor loaded with stock 9; meanwhile a customer buys 7 → stock 2
    await ProductModel.updateOne(
      { _id: product!._id, variants: { $elemMatch: { sku: "AP-alpha" } } },
      { $set: { "variants.$.stock": 2 } },
    );

    // admin saves only the weight (stock unchanged in the form) → sale survives
    const unrelated = await updateVariantCore(id, "AP-alpha", {
      priceDeltaCents: 0,
      stock: 9,
      expectedStock: 9,
      weightGrams: 220,
      attributes: { color: "blau", storage: 128 },
    });
    expect(unrelated.ok).toBe(true);
    let fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.stock).toBe(2);
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.weightGrams).toBe(220);

    // an explicit stock edit against a stale expectation is refused, nothing moves
    const conflict = await updateVariantCore(id, "AP-alpha", {
      priceDeltaCents: 0,
      stock: 50,
      expectedStock: 9,
      weightGrams: 220,
      attributes: { color: "blau", storage: 128 },
    });
    expect(conflict.ok).toBe(false);
    fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.stock).toBe(2);

    // with the current value as expectation the explicit edit goes through
    const ok = await updateVariantCore(id, "AP-alpha", {
      priceDeltaCents: 0,
      stock: 50,
      expectedStock: 2,
      weightGrams: 220,
      attributes: { color: "blau", storage: 128 },
    });
    expect(ok.ok).toBe(true);
    fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.stock).toBe(50);
  });

  it("core product save does not clobber concurrent stock changes (issue #13)", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const id = product!._id.toString();
    await ProductModel.updateOne(
      { _id: product!._id, variants: { $elemMatch: { sku: "AP-alpha-w" } } },
      { $set: { "variants.$.stock": 1 } },
    );
    const loaded = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(loaded?.variants.find((v) => v.sku === "AP-alpha-w")?.stock).toBe(1);

    const result = await updateProductCore(id, {
      name: "Nach Verkauf umbenannt",
      description: "Beschreibung wurde nach dem Verkauf geändert.",
      brand: "Apple",
      priceCents: 51000,
    });
    expect(result.ok).toBe(true);
    const fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.name).toBe("Nach Verkauf umbenannt");
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha-w")?.stock).toBe(1);
  });

  it("manages product images: add, remove, reorder, alt texts (issue #22)", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const id = product!._id.toString();

    const ok = await updateImagesCore(id, {
      images: [
        { src: "/products/alpha-2.webp", alt: "Alpha – Seitenansicht" },
        { src: "/products/alpha-1.webp", alt: "Alpha – Frontansicht" },
      ],
    });
    expect(ok.ok).toBe(true);
    let fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.images.map((i) => i.src)).toEqual([
      "/products/alpha-2.webp",
      "/products/alpha-1.webp",
    ]);
    expect(fresh?.images[0]?.alt).toBe("Alpha – Seitenansicht");

    const empty = await updateImagesCore(id, { images: [] });
    expect(empty.ok).toBe(false);

    const tooMany = await updateImagesCore(id, {
      images: Array.from({ length: 6 }, (_, n) => ({
        src: `/products/alpha-${n}.webp`,
        alt: `Alpha – Ansicht ${n}`,
      })),
    });
    expect(tooMany.ok).toBe(false);

    const notAPhoto = await updateImagesCore(id, {
      images: [{ src: "/products/alpha-1.svg", alt: "Zeichnung" }],
    });
    expect(notAPhoto.ok).toBe(false);

    const foreign = await updateImagesCore(id, {
      images: [{ src: "https://evil.example/x.webp", alt: "Fremdquelle" }],
    });
    expect(foreign.ok).toBe(false);

    const duplicate = await updateImagesCore(id, {
      images: [
        { src: "/products/alpha-1.webp", alt: "Alpha – Frontansicht" },
        { src: "/products/alpha-1.webp", alt: "Alpha – Duplikat" },
      ],
    });
    expect(duplicate.ok).toBe(false);

    const unknown = await updateImagesCore("000000000000000000000000", {
      images: [{ src: "/products/alpha-1.webp", alt: "Alpha – Frontansicht" }],
    });
    expect(unknown.ok).toBe(false);

    fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.images).toHaveLength(2);
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

describe("adminProductsQuerySchema (issue #32)", () => {
  it("passes through valid search parameters", () => {
    expect(
      adminProductsQuerySchema.parse({ q: "iphone", type: "smartphone", page: "2" }),
    ).toEqual({ q: "iphone", type: "smartphone", page: 2 });
  });

  it("falls back to unset instead of breaking on junk", () => {
    expect(adminProductsQuerySchema.parse({ q: "", type: "quatsch", page: "abc" })).toEqual({});
    expect(adminProductsQuerySchema.parse({ page: "0" })).toEqual({});
    expect(adminProductsQuerySchema.parse({})).toEqual({});
  });

  it("takes the first value of repeated parameters", () => {
    expect(adminProductsQuerySchema.parse({ q: ["a", "b"], page: ["3", "9"] })).toEqual({
      q: "a",
      page: 3,
    });
  });
});
