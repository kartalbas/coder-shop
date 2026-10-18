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
    filter: { color: ["schwarz", "weiß"], storage: ["128", "256"] },
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

// Issue #62 (#54): a quantity-tracked product — explicit stock edits stay allowed here,
// while the smartphone fixtures above are serial-tracked and refuse them.
async function seedShoe(slug: string) {
  return ProductModel.create({
    slug,
    name: `Admin Test ${slug}`,
    description: "Schuh für Admin-Produkt-Tests.",
    type: "shoes",
    brand: "Nike",
    priceCents: 15000,
    images: [{ src: `/products/${slug}-1.svg`, alt: "Test" }],
    featured: false,
    filter: { color: ["schwarz"], size: ["42"] },
    variants: [
      {
        sku: `AP-${slug}`,
        label: "42 / schwarz",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 400,
        attributes: { color: "schwarz", size: 42 },
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
    await seedShoe("shoe");
  });

  afterAll(disconnectTestDB);

  it("lists products with stock totals and searches by name, brand and sku", async () => {
    const all = await listProductsAdmin({});
    expect(all.total).toBe(3);
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
    // Issue #62 (#54): AP-alpha is serial-tracked — the save keeps the stock as is.
    const result = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: 5,
      expectedStock: 5,
      weightGrams: 210,
      attributes: { color: "blau", storage: 128 },
    });
    expect(result.ok).toBe(true);

    const fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.filter.color).toEqual(["blau", "weiß"]);
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.stock).toBe(5);
    // Issue #61: the label is built from the type's configured dimensions, in order.
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.label).toBe("blau / 128 GB");

    const dto = await getProductBySlug("alpha");
    expect(dto?.filter.color).toEqual(["blau", "weiß"]);

    const listing = await listProducts({ type: "smartphone", facets: { color: ["blau"] } });
    expect(listing.items.map((i) => i.slug)).toContain("alpha");
    const facets = await listProducts({ type: "smartphone" });
    expect(facets.facets.dimensions.color.map((f) => f.value)).toContain("blau");
  });

  it("refuses variant attributes outside the type's dimensions (issue #61)", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const missing = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: 5,
      expectedStock: 5,
      weightGrams: 200,
      attributes: { color: "blau" }, // storage is a configured dimension of smartphones
    });
    expect(missing.ok).toBe(false);

    const unknown = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: 5,
      expectedStock: 5,
      weightGrams: 200,
      attributes: { color: "blau", storage: 128, farbe: "blau" },
    });
    expect(unknown.ok).toBe(false);
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
      expectedStock: 5,
      weightGrams: 100,
      attributes: { color: "blau", storage: 128 },
    });
    expect(negative.ok).toBe(false);
  });

  // Issue #62 (#54): the stock of a serial-tracked variant is the count of its
  // in-stock units — a free-form edit is refused, nothing moves.
  it("refuses a direct stock edit on a serial-tracked variant (issue #62)", async () => {
    const product = await ProductModel.findOne({ slug: "alpha" }).exec();
    const result = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 0,
      stock: 50,
      expectedStock: 5,
      weightGrams: 200,
      attributes: { color: "blau", storage: 128 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Seriennummer");

    const fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-alpha")?.stock).toBe(5);

    // The same save without touching the stock goes through.
    const untouched = await updateVariantCore(product!._id.toString(), "AP-alpha", {
      priceDeltaCents: 100,
      stock: 5,
      expectedStock: 5,
      weightGrams: 200,
      attributes: { color: "blau", storage: 128 },
    });
    expect(untouched.ok).toBe(true);
  });

  // Issue #62: runs on the quantity-tracked shoe — serial-tracked variants refuse
  // explicit stock edits entirely (covered by the #62 test above).
  it("does not overwrite stock that changed while the editor was open (issue #13)", async () => {
    const product = await ProductModel.findOne({ slug: "shoe" }).exec();
    const id = product!._id.toString();
    // editor loaded with stock 5; meanwhile a customer buys 3 → stock 2
    await ProductModel.updateOne(
      { _id: product!._id, variants: { $elemMatch: { sku: "AP-shoe" } } },
      { $set: { "variants.$.stock": 2 } },
    );

    // admin saves only the weight (stock unchanged in the form) → sale survives
    const unrelated = await updateVariantCore(id, "AP-shoe", {
      priceDeltaCents: 0,
      stock: 5,
      expectedStock: 5,
      weightGrams: 220,
      attributes: { color: "schwarz", size: 42 },
    });
    expect(unrelated.ok).toBe(true);
    let fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-shoe")?.stock).toBe(2);
    expect(fresh?.variants.find((v) => v.sku === "AP-shoe")?.weightGrams).toBe(220);

    // an explicit stock edit against a stale expectation is refused, nothing moves
    const conflict = await updateVariantCore(id, "AP-shoe", {
      priceDeltaCents: 0,
      stock: 50,
      expectedStock: 5,
      weightGrams: 220,
      attributes: { color: "schwarz", size: 42 },
    });
    expect(conflict.ok).toBe(false);
    fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-shoe")?.stock).toBe(2);

    // with the current value as expectation the explicit edit goes through
    const ok = await updateVariantCore(id, "AP-shoe", {
      priceDeltaCents: 0,
      stock: 50,
      expectedStock: 2,
      weightGrams: 220,
      attributes: { color: "schwarz", size: 42 },
    });
    expect(ok.ok).toBe(true);
    fresh = await ProductModel.findById(product!._id).lean<Product>().exec();
    expect(fresh?.variants.find((v) => v.sku === "AP-shoe")?.stock).toBe(50);
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
    // Issue #61: the type filter is free-form — an unknown key simply matches no
    // product instead of breaking the page.
    expect(adminProductsQuerySchema.parse({ q: "", type: "quatsch", page: "abc" })).toEqual({
      type: "quatsch",
    });
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
