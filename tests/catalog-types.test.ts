import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_TYPES, type CatalogTypeConfig } from "@/lib/catalog-types";
import { deriveFilter } from "@/lib/facets";
import { menuCategories } from "@/lib/menu";
import { ProductModel } from "@/models/product";
import { ProductTypeConfigModel } from "@/models/product-type-config";
import { parseListingParams } from "@/lib/validations/listing";
import { createOrderCore } from "@/server/checkout";
import { listProducts, getProductBySlug } from "@/server/search";
import { listProductsAdmin, updateVariantCore } from "@/server/products-admin";
import { getCatalogTypes, saveCatalogTypeCore } from "@/server/catalog-types";
import { seedCatalogTypes } from "../scripts/seed/seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #61 done-when: a fourth product type created at runtime — with its own
// attributes — works end to end (menu, listing, filters, product page, cart/checkout,
// admin) without a single code change.

const ACCESSORIES: CatalogTypeConfig = {
  key: "accessories",
  label: "Zubehör",
  position: 4,
  stockTracking: "quantity",
  comparable: false,
  photoNoun: "cable organiser",
  brands: ["Anker", "Belkin"],
  dimensions: [
    { key: "color", label: "Farbe", facet: true, order: "alpha" },
    { key: "compatibility", label: "Kompatibilität", facet: true, order: "alpha" },
    { key: "length", label: "Länge", facet: false, order: "numeric", unit: "m" },
  ],
};

async function seedAccessory() {
  const variants = [
    {
      sku: "AC-0001-SCHWARZ-USB-C-1",
      label: "schwarz / USB-C / 1 m",
      priceDeltaCents: 0,
      stock: 4,
      restockThreshold: 2,
      weightGrams: 60,
      attributes: { color: "schwarz", compatibility: "USB-C", length: "1" },
    },
    {
      sku: "AC-0002-WEISS-LIGHTNING-2",
      label: "weiss / Lightning / 2 m",
      priceDeltaCents: 300,
      stock: 2,
      restockThreshold: 2,
      weightGrams: 55,
      attributes: { color: "weiss", compatibility: "Lightning", length: "2" },
    },
  ];
  await ProductModel.create({
    slug: "anker-kabel-ac-001",
    name: "Anker Kabel Pro",
    description: "Ein robustes Ladekabel für das Zubehör-Testregal.",
    type: "accessories",
    brand: "Anker",
    priceCents: 1900,
    images: [{ src: "/products/anker-kabel-ac-001-1.webp", alt: "Anker Kabel Pro – Ansicht 1" }],
    featured: false,
    filter: deriveFilter(variants, ACCESSORIES.dimensions),
    variants,
  });
}

describe("catalog type configuration (issue #61)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("falls back to the seed content while the collection is empty", async () => {
    const types = await getCatalogTypes();
    expect(types.map((t) => t.key)).toEqual(["smartphone", "shoes", "clothing"]);
  });

  it("validates the configuration shape", async () => {
    expect((await saveCatalogTypeCore({ ...ACCESSORIES, key: "Zubehör!" })).ok).toBe(false);
    expect((await saveCatalogTypeCore({ ...ACCESSORIES, label: "  " })).ok).toBe(false);
    expect((await saveCatalogTypeCore({ ...ACCESSORIES, photoNoun: "  " })).ok).toBe(false);
    expect((await saveCatalogTypeCore({ ...ACCESSORIES, dimensions: [] })).ok).toBe(false);
    expect(
      (await saveCatalogTypeCore({ ...ACCESSORIES, dimensions: [ACCESSORIES.dimensions[0]!, { ...ACCESSORIES.dimensions[0]! }] })).ok,
    ).toBe(false);
    expect((await saveCatalogTypeCore(ACCESSORIES)).ok).toBe(true);
  });

  it("the new type works end to end without a code change", async () => {
    await seedCatalogTypes(); // the three demo types as data, insert-only
    await seedAccessory();
    const types = await getCatalogTypes();
    expect(types.map((t) => t.key)).toEqual(["smartphone", "shoes", "clothing", "accessories"]);

    // Menu / tabs / footer.
    const categories = menuCategories(types);
    expect(categories.map((c) => c.type)).toContain("accessories");
    expect(categories.find((c) => c.type === "accessories")?.label).toBe("Zubehör");

    // Listing params accept the new type and its facet dimensions only.
    const parsed = parseListingParams(
      { type: "accessories", compatibility: "USB-C", storage: "256" },
      types,
    );
    expect(parsed.type).toBe("accessories");
    expect(parsed.facets).toEqual({ compatibility: ["USB-C"] });

    // Listing: results, facet counts over the configured dimensions.
    const listing = await listProducts(parsed);
    expect(listing.items.map((i) => i.slug)).toEqual(["anker-kabel-ac-001"]);
    expect(listing.dimensions.map((d) => d.key)).toEqual(["color", "compatibility"]);
    expect(listing.facets.dimensions.compatibility?.find((f) => f.value === "USB-C")?.count).toBe(1);
    expect(listing.facets.dimensions.compatibility?.find((f) => f.value === "Lightning")?.count).toBe(1);
    // The non-facet dimension stays out of the facet column but is a real attribute.
    expect(listing.facets.dimensions.length).toBeUndefined();

    // Browsing "Alle" offers the union of all configured facet dimensions.
    const all = await listProducts({});
    expect(Object.keys(all.facets.dimensions).sort()).toEqual([
      "color",
      "compatibility",
      "material",
      "size",
      "storage",
    ]);

    // Product page DTO: derived filter, dimensions, comparable flag from the config.
    const dto = await getProductBySlug("anker-kabel-ac-001");
    expect(dto?.filter.color).toEqual(["schwarz", "weiss"]);
    expect(dto?.filter.compatibility).toEqual(["Lightning", "USB-C"]);
    expect(dto?.comparable).toBe(false);

    // Cart/checkout: an order over the new type's variant goes through.
    const order = await createOrderCore({
      customer: {
        name: "Test Person",
        email: "test@example.ch",
        phone: "079 000 00 00",
        street: "Testweg 1",
        postalCode: "8000",
        city: "Zürich",
        country: "CH",
      },
      lines: [
        {
          sku: "AC-0001-SCHWARZ-USB-C-1",
          qty: 2,
          expectedUnitPriceCents: 1900,
        },
      ],
      shippingMethod: "standard",
    });
    expect(order.ok).toBe(true);

    // Admin: the type filter finds it, the variant editor's write validates against
    // the new dimensions.
    const admin = await listProductsAdmin({ type: "accessories" });
    expect(admin.items.map((i) => i.slug)).toEqual(["anker-kabel-ac-001"]);
    const product = await ProductModel.findOne({ slug: "anker-kabel-ac-001" }).exec();
    const valid = await updateVariantCore(product!._id.toString(), "AC-0001-SCHWARZ-USB-C-1", {
      priceDeltaCents: 0,
      stock: 4,
      expectedStock: 4,
      weightGrams: 60,
      attributes: { color: "rot", compatibility: "USB-C", length: "1" },
    });
    expect(valid.ok).toBe(true);
    const unknown = await updateVariantCore(product!._id.toString(), "AC-0001-SCHWARZ-USB-C-1", {
      priceDeltaCents: 0,
      stock: 4,
      expectedStock: 4,
      weightGrams: 60,
      attributes: { color: "rot", compatibility: "USB-C", length: "1", storage: 128 },
    });
    expect(unknown.ok).toBe(false);
  });

  it("an edited configuration survives a re-seed (insert-only, issue #14)", async () => {
    await saveCatalogTypeCore({ ...ACCESSORIES, label: "Zubehör & Kabel" });
    await seedCatalogTypes();
    const stored = await ProductTypeConfigModel.findOne({ key: "accessories" }).lean().exec();
    expect(stored?.label).toBe("Zubehör & Kabel");
    // The seed content itself is untouched.
    const phone = await ProductTypeConfigModel.findOne({ key: "smartphone" }).lean().exec();
    expect(phone?.comparable).toBe(true);
    expect(DEFAULT_CATALOG_TYPES.some((t) => t.key === "smartphone")).toBe(true);
    // #64: the seed hands out the STORED configs (the filter repair derives from them),
    // not the defaults — an edited dimension set must be what comes back.
    const editedDimensions = [
      ...ACCESSORIES.dimensions,
      { key: "material", label: "Material", facet: true, order: "alpha" as const },
    ];
    await saveCatalogTypeCore({ ...ACCESSORIES, dimensions: editedDimensions });
    const reseeded = await seedCatalogTypes();
    const accessories = reseeded.find((type) => type.key === "accessories");
    expect(accessories?.dimensions.map((d) => d.key)).toContain("material");
  });
});
