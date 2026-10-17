import { ProductModel, type Product } from "@/models/product";
import { UserModel, type User } from "@/models/user";
import { toProductDto, type ProductDto } from "./search";
import { connectDB } from "./db";
import { getCatalogTypes } from "./catalog-types";

// Server side of the wishlist (issue #46). The browser store is the working copy; this
// is the account copy it syncs into — slugs, newest first, capped, only products that
// still exist.

export const WISHLIST_MAX_ITEMS = 100;

function sanitize(slugs: string[]): string[] {
  return [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))].slice(0, WISHLIST_MAX_ITEMS);
}

// "merge" (on login/first mount): the local items join the stored ones, local order
// wins; "replace" (on every later local change): the local list is the truth.
export async function syncWishlistCore(
  userId: string,
  slugs: string[],
  mode: "merge" | "replace",
): Promise<string[]> {
  await connectDB();
  const user = await UserModel.findById(userId).select("wishlist role").lean<User>().exec();
  if (!user || user.role !== "customer") return [];
  const local = sanitize(slugs);
  const ordered = mode === "merge" ? [...local, ...(user.wishlist ?? [])] : local;
  const existing = await ProductModel.find({ slug: { $in: ordered } }).select("slug").lean().exec();
  const known = new Set(existing.map((product) => product.slug));
  const next = [...new Set(ordered.filter((slug) => known.has(slug)))].slice(0, WISHLIST_MAX_ITEMS);
  await UserModel.updateOne({ _id: userId }, { $set: { wishlist: next } });
  return next;
}

// The account's wishlist as DTOs, in the stored (newest-first) order.
export async function getWishlistProductsCore(userId: string): Promise<ProductDto[]> {
  await connectDB();
  const user = await UserModel.findById(userId).select("wishlist").lean<User>().exec();
  const slugs = user?.wishlist ?? [];
  if (slugs.length === 0) return [];
  const [docs, types] = await Promise.all([
    ProductModel.find({ slug: { $in: slugs } }).lean<Product[]>().exec(),
    getCatalogTypes(),
  ]);
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined)
    .map((doc) => toProductDto(doc, types.some((t) => t.key === doc.type && t.comparable)));
}

export async function removeFromWishlistCore(userId: string, slug: string): Promise<boolean> {
  await connectDB();
  const updated = await UserModel.updateOne(
    { _id: userId, role: "customer" },
    { $pull: { wishlist: slug } },
  ).exec();
  return updated.matchedCount > 0;
}
