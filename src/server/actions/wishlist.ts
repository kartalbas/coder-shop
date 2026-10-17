"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { removeFromWishlistCore, syncWishlistCore } from "@/server/wishlist";
import { getCustomerSessionUserId } from "@/server/session";

// Wishlist actions (issue #46). All of them are no-ops for anonymous visitors — the
// browser store keeps working locally; only a customer session has an account copy.

const slugListSchema = z.array(z.string().trim().min(1).max(120)).max(100);

export type SyncWishlistResult = { ok: true; slugs: string[] } | { ok: false };

export async function syncWishlistAction(
  rawSlugs: unknown,
  mode: "merge" | "replace",
): Promise<SyncWishlistResult> {
  const userId = await getCustomerSessionUserId();
  if (!userId) return { ok: false };
  const parsed = slugListSchema.safeParse(rawSlugs);
  if (!parsed.success) return { ok: false };
  return { ok: true, slugs: await syncWishlistCore(userId, parsed.data, mode) };
}

export async function removeWishlistItemAction(slug: string): Promise<{ ok: boolean }> {
  const userId = await getCustomerSessionUserId();
  if (!userId) return { ok: false };
  const parsed = z.string().trim().min(1).max(120).safeParse(slug);
  if (!parsed.success) return { ok: false };
  const removed = await removeFromWishlistCore(userId, parsed.data);
  revalidatePath("/konto/wunschliste");
  return { ok: removed };
}
