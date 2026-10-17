"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import {
  createPurchaseOrderCore,
  createSupplierCore,
  markPurchaseOrderOrderedCore,
  receivePurchaseOrderCore,
  searchVariantsBySku,
  toSupplierInput,
  updateSupplierCore,
  type SkuSearchHit,
} from "@/server/purchasing";
import { requireAdminSession } from "@/server/session";

export interface PurchasingActionState {
  ok?: boolean;
  error?: string;
}

function revalidatePurchasing(): void {
  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/purchasing/[id]", "page");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin");
}

export async function saveSupplierAction(
  _previous: PurchasingActionState | null,
  formData: FormData,
): Promise<PurchasingActionState> {
  await requireAdminSession();
  const input = toSupplierInput(formData);
  if (!input) return { error: "Bitte Eingaben prüfen." };

  const supplierId = formData.get("supplierId");
  const result =
    typeof supplierId === "string" && supplierId.length > 0
      ? await updateSupplierCore(supplierId, input)
      : await createSupplierCore(input);
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  return { ok: true };
}

export async function createPurchaseOrderAction(
  _previous: PurchasingActionState | null,
  formData: FormData,
): Promise<PurchasingActionState> {
  await requireAdminSession();
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "Ungültige Formular-Daten." };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Ungültige Formular-Daten." };
  }

  const result = await createPurchaseOrderCore(json);
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  redirect(`/admin/purchasing/${result.poId}`);
}

const poIdSchema = objectIdSchema;

export async function markPurchaseOrderOrderedAction(
  _previous: PurchasingActionState | null,
  formData: FormData,
): Promise<PurchasingActionState> {
  await requireAdminSession();
  const poId = poIdSchema.safeParse(formData.get("poId"));
  if (!poId.success) return { error: "Ungültige Anfrage." };

  const result = await markPurchaseOrderOrderedCore(poId.data);
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  return { ok: true };
}

export async function receivePurchaseOrderAction(
  _previous: PurchasingActionState | null,
  formData: FormData,
): Promise<PurchasingActionState & { summary?: string }> {
  await requireAdminSession();
  const poId = poIdSchema.safeParse(formData.get("poId"));
  if (!poId.success) return { error: "Ungültige Anfrage." };

  const result = await receivePurchaseOrderCore(poId.data);
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  return {
    ok: true,
    summary: result.restocked
      .map((entry) => `${entry.qty}× ${entry.sku}`)
      .join(", "),
  };
}

const skuQuerySchema = z.string().trim().max(100);

export async function searchSkuAction(query: unknown): Promise<SkuSearchHit[]> {
  await requireAdminSession();
  // Boundary validation: this action is called directly from the client with arbitrary
  // values; anything but a short string is simply "no search", never a 500.
  const parsed = skuQuerySchema.safeParse(query);
  if (!parsed.success) return [];
  return searchVariantsBySku(parsed.data);
}
