"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { label } from "@/lib/i18n";
import { objectIdSchema } from "@/lib/validations/common";
import { getRequestLabels } from "@/server/i18n";
import {
  toggleFeaturedCore,
  updateImagesCore,
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
  const invalidRequest = label(await getRequestLabels(), "admin.error.invalidRequest");
  const productId = objectIdSchema.safeParse(formData.get("productId"));
  const payload = parsePayload(formData);
  if (!productId.success || payload === null) return { error: invalidRequest };

  const result = await updateProductCore(productId.data, payload);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId.data);
  return { ok: true };
}

export async function updateVariantAction(
  _previous: ProductActionState | null,
  formData: FormData,
): Promise<ProductActionState> {
  await requireAdminSession();
  const invalidRequest = label(await getRequestLabels(), "admin.error.invalidRequest");
  const productId = objectIdSchema.safeParse(formData.get("productId"));
  const sku = z.string().min(1).max(64).safeParse(formData.get("sku"));
  const payload = parsePayload(formData);
  if (!productId.success || !sku.success || payload === null) {
    return { error: invalidRequest };
  }

  const result = await updateVariantCore(productId.data, sku.data, payload);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId.data);
  return { ok: true };
}

export async function updateImagesAction(
  _previous: ProductActionState | null,
  formData: FormData,
): Promise<ProductActionState> {
  await requireAdminSession();
  const invalidRequest = label(await getRequestLabels(), "admin.error.invalidRequest");
  const productId = objectIdSchema.safeParse(formData.get("productId"));
  const payload = parsePayload(formData);
  if (!productId.success || payload === null) return { error: invalidRequest };

  const result = await updateImagesCore(productId.data, payload);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId.data);
  return { ok: true };
}

export async function toggleFeaturedAction(
  _previous: ProductActionState | null,
  formData: FormData,
): Promise<ProductActionState> {
  await requireAdminSession();
  const invalidRequest = label(await getRequestLabels(), "admin.error.invalidRequest");
  const productId = objectIdSchema.safeParse(formData.get("productId"));
  if (!productId.success) return { error: invalidRequest };

  const result = await toggleFeaturedCore(productId.data);
  if (!result.ok) return { error: result.error };

  revalidateProducts(productId.data);
  return { ok: true };
}
