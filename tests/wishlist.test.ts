import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProductModel } from "@/models/product";
import { UserModel } from "@/models/user";
import {
  getWishlistProductsCore,
  removeFromWishlistCore,
  syncWishlistCore,
  WISHLIST_MAX_ITEMS,
} from "@/server/wishlist";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

async function seedProduct(slug: string) {
  await ProductModel.create({
    slug,
    name: `Wunschliste ${slug}`,
    description: "Produkt für Wishlist-Integrationstests.",
    type: "shoes",
    brand: "Testmarke",
    priceCents: 12_000,
    images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: ["42"], storage: [], materials: [] },
    variants: [
      {
        sku: `WL-${slug}`,
        label: "42 / schwarz",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 400,
        attributes: { color: "schwarz", size: "42" },
      },
    ],
  });
}

describe("wishlist account sync (issue #46)", () => {
  let userId: string;

  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    const user = await UserModel.create({
      email: "wishlist@example.ch",
      name: "Wunsch Person",
      passwordHash: "scrypt$2$8$1$c2FsdA==$aGFzaA==",
      role: "customer",
    });
    userId = user._id.toString();
    await seedProduct("schuh-a");
    await seedProduct("schuh-b");
    await seedProduct("schuh-c");
  });

  afterAll(disconnectTestDB);

  it("merge keeps the local order in front and adds the stored items", async () => {
    await UserModel.updateOne({ _id: userId }, { $set: { wishlist: ["schuh-b"] } });
    const merged = await syncWishlistCore(userId, ["schuh-a", "schuh-c"], "merge");
    expect(merged).toEqual(["schuh-a", "schuh-c", "schuh-b"]);
  });

  it("replace makes the local list the truth", async () => {
    const replaced = await syncWishlistCore(userId, ["schuh-c"], "replace");
    expect(replaced).toEqual(["schuh-c"]);
    const user = await UserModel.findById(userId).select("wishlist").lean().exec();
    expect(user?.wishlist).toEqual(["schuh-c"]);
  });

  it("drops unknown slugs and caps at the maximum", async () => {
    const withUnknown = await syncWishlistCore(userId, ["schuh-a", "gibts-nicht"], "replace");
    expect(withUnknown).toEqual(["schuh-a"]);

    const many = ["schuh-b", ...Array.from({ length: WISHLIST_MAX_ITEMS + 10 }, (_, i) => `schuh-${i}`)];
    const capped = await syncWishlistCore(userId, many, "replace");
    expect(capped).toEqual(["schuh-b"]); // the cap drops the rest, only known slugs stay
  });

  it("the portal list keeps the stored order and skips deleted products", async () => {
    await syncWishlistCore(userId, ["schuh-c", "schuh-a"], "replace");
    const products = await getWishlistProductsCore(userId);
    expect(products.map((product) => product.slug)).toEqual(["schuh-c", "schuh-a"]);

    await ProductModel.deleteOne({ slug: "schuh-c" });
    const afterDelete = await getWishlistProductsCore(userId);
    expect(afterDelete.map((product) => product.slug)).toEqual(["schuh-a"]);
    await seedProduct("schuh-c");
  });

  it("removeFromWishlistCore removes one and refuses non-customers", async () => {
    await syncWishlistCore(userId, ["schuh-a", "schuh-b"], "replace");
    expect(await removeFromWishlistCore(userId, "schuh-a")).toBe(true);
    const user = await UserModel.findById(userId).select("wishlist").lean().exec();
    expect(user?.wishlist).toEqual(["schuh-b"]);

    const admin = await UserModel.create({
      email: "wishlist-admin@example.ch",
      name: "Admin",
      passwordHash: "scrypt$2$8$1$c2FsdA==$aGFzaA==",
      role: "admin",
    });
    expect(await syncWishlistCore(admin._id.toString(), ["schuh-a"], "replace")).toEqual([]);
    expect(await removeFromWishlistCore(admin._id.toString(), "schuh-a")).toBe(false);
  });
});
