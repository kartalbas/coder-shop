"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { objectIdSchema } from "@/lib/validations/common";
import { label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import {
  createPurchaseOrderCore,
  createSupplierCore,
  markPurchaseOrderOrderedCore,
  receivePurchaseOrderCore,
  searchSuppliers,
  searchVariantsBySku,
  setExpectedArrivalCore,
  toSupplierInput,
  updateSupplierCore,
  type SkuSearchHit,
  type SupplierSearchHit,
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
  const labels = await getRequestLabels();
  const input = toSupplierInput(formData, labels);
  if (!input) return { error: label(labels, "admin.purchasing.error.checkInputs") };

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
  const labels = await getRequestLabels();
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: label(labels, "admin.purchasing.error.formInvalid") };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: label(labels, "admin.purchasing.error.formInvalid") };
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
  const labels = await getRequestLabels();
  const poId = poIdSchema.safeParse(formData.get("poId"));
  if (!poId.success) return { error: label(labels, "admin.error.invalidRequest") };

  const result = await markPurchaseOrderOrderedCore(poId.data);
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  return { ok: true };
}

// Issue #62 (#55): the goods receipt can be partial — the form sends the received
// quantity per SKU; anything missing keeps the PO on order.
const receiveQuantitiesSchema = z.record(z.string(), z.number().int().min(0).max(100000));

// Issue #62 (#54): serial numbers per SKU for serial-tracked receipt lines.
const receiveSerialsSchema = z.record(z.string(), z.array(z.string().max(80)).max(1000));

export async function receivePurchaseOrderAction(
  _previous: PurchasingActionState | null,
  formData: FormData,
): Promise<PurchasingActionState & { summary?: string; complete?: boolean }> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  const poId = poIdSchema.safeParse(formData.get("poId"));
  if (!poId.success) return { error: label(labels, "admin.error.invalidRequest") };

  let quantities: Record<string, number> | undefined;
  const raw = formData.get("quantities");
  if (typeof raw === "string" && raw.length > 0) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return { error: label(labels, "admin.purchasing.error.formInvalid") };
    }
    const parsed = receiveQuantitiesSchema.safeParse(json);
    if (!parsed.success) return { error: label(labels, "admin.purchasing.error.invalidQuantities") };
    quantities = parsed.data;
  }

  let serials: Record<string, string[]> | undefined;
  const rawSerials = formData.get("serials");
  if (typeof rawSerials === "string" && rawSerials.length > 0) {
    let json: unknown;
    try {
      json = JSON.parse(rawSerials);
    } catch {
      return { error: label(labels, "admin.purchasing.error.formInvalid") };
    }
    const parsed = receiveSerialsSchema.safeParse(json);
    if (!parsed.success) return { error: label(labels, "admin.purchasing.error.invalidSerials") };
    serials = parsed.data;
  }

  const result = await receivePurchaseOrderCore(poId.data, quantities, serials);
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  return {
    ok: true,
    complete: result.complete,
    summary: result.restocked
      .map((entry) => `${entry.qty}× ${entry.sku}`)
      .join(", "),
  };
}

// Issue #62 (#55): the expected arrival is editable per purchase order.
const expectedArrivalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function setExpectedArrivalAction(
  _previous: PurchasingActionState | null,
  formData: FormData,
): Promise<PurchasingActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  const poId = poIdSchema.safeParse(formData.get("poId"));
  const date = expectedArrivalSchema.safeParse(formData.get("arrival"));
  if (!poId.success || !date.success) return { error: label(labels, "admin.error.invalidRequest") };

  const result = await setExpectedArrivalCore(poId.data, new Date(`${date.data}T12:00:00Z`));
  if (!result.ok) return { error: result.error };

  revalidatePurchasing();
  return { ok: true };
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

const supplierQuerySchema = z.string().trim().max(100);

// Supplier search for the PO picker dialog (issue #42) — same boundary rules as the
// variant search: junk input means "no search", never a 500.
export async function searchSupplierAction(
  query: unknown,
): Promise<SupplierSearchHit[]> {
  await requireAdminSession();
  const parsed = supplierQuerySchema.safeParse(query);
  if (!parsed.success) return [];
  return searchSuppliers(parsed.data);
}
