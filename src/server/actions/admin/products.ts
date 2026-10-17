"use server";

import { revalidatePath } from "next/cache";
import {
  toggleFeaturedCore,
  updateProductCore,
  updateVariantCore,
} from "@/server/products-admin";
import { requireAdminSession } from "@/server/session";

export interface ProductActionState {
  ok?: boolean;
  error?: string;
}

function revalidateProducts(productId?: string): void {
  revalidatePath("/admin/products");
  if (productId) revalidatePath("/admin/products/[id]", "page");
}

function parsePayload(formData: FormData): unknown | null {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function updateProductAction(
  _previous: ProductActionState | null,
  formData: FormData,
): Promise<ProductActionState> {
  await requireAdminSession();
  const productId = formData.get("productId");
  const payload = parsePayload(formData);
  if (typeof productId !== "string" || payload === null) return { error: "Ungültige Anfrage." };

  const result = await updateProductCore(productId, payload);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId);
  return { ok: true };
}

export async function updateVariantAction(
  _previous: ProductActionState | null,
  formData: FormData,
): Promise<ProductActionState> {
  await requireAdminSession();
  const productId = formData.get("productId");
  const sku = formData.get("sku");
  const payload = parsePayload(formData);
  if (typeof productId !== "string" || typeof sku !== "string" || payload === null) {
    return { error: "Ungültige Anfrage." };
  }

  const result = await updateVariantCore(productId, sku, payload);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId);
  return { ok: true };
}

export async function toggleFeaturedAction(
  _previous: ProductActionState | null,
  formData: FormData,
): Promise<ProductActionState> {
  await requireAdminSession();
  const productId = formData.get("productId");
  if (typeof productId !== "string") return { error: "Ungültige Anfrage." };

  const result = await toggleFeaturedCore(productId);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId);
  return { ok: true };
}
