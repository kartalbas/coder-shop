"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CONFIG_KEY_PATTERN,
  contentSaveIsNoop,
  LANGUAGE_CODE_PATTERN,
  label,
  typeLabelKey,
  type LabelMap,
} from "@/lib/i18n";
import { getRequestLabels, getTranslations, saveTranslationCore } from "@/server/i18n";
import { getCatalogType, saveCatalogTypeCore } from "@/server/catalog-types";
import { requireAdminSession } from "@/server/session";

export interface CatalogTypeActionState {
  ok?: boolean;
  error?: string;
}

// Issue #58 step 3: the schema is a label-map factory — every message comes from the
// translation table in the request language.
function createCatalogTypeSchema(labels: LabelMap) {
  const dimensionKey = z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9]*$/, label(labels, "admin.catalogTypes.validation.dimensionKeyShape"));
  return z.object({
    key: z
      .string()
      .trim()
      .regex(CONFIG_KEY_PATTERN, label(labels, "admin.catalogTypes.validation.keyShape")),
    label: z.string().trim().min(1, label(labels, "admin.settings.validation.nameRequired")),
    position: z.coerce.number().int().min(0).max(999),
    stockTracking: z.enum(["quantity", "serial"]),
    comparable: z.boolean(),
    photoNoun: z
      .string()
      .trim()
      .min(1, label(labels, "admin.catalogTypes.validation.photoNounMissing")),
    brands: z.array(z.string().trim().min(1).max(60)),
    dimensions: z
      .array(
        z.object({
          key: dimensionKey,
          label: z
            .string()
            .trim()
            .min(1, label(labels, "admin.catalogTypes.validation.dimensionNameMissing")),
          facet: z.boolean(),
          order: z.enum(["alpha", "numeric", "clothing-size"]),
          unit: z.string().trim().max(12),
        }),
      )
      .min(1, label(labels, "admin.catalogTypes.validation.dimensionsRequired")),
  });
}

// Issue #64: the admin edits the catalog type configuration (#61 rows) through the
// validated core — the same write path the seed and tests use.
export async function saveCatalogTypeAction(
  _previous: CatalogTypeActionState | null,
  formData: FormData,
): Promise<CatalogTypeActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: label(labels, "admin.error.invalidRequest") };
  }
  const parsed = createCatalogTypeSchema(labels).safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? label(labels, "admin.error.invalidRequest"),
    };
  }
  const result = await saveCatalogTypeCore({
    key: parsed.data.key,
    label: parsed.data.label,
    position: parsed.data.position,
    stockTracking: parsed.data.stockTracking,
    comparable: parsed.data.comparable,
    photoNoun: parsed.data.photoNoun,
    brands: parsed.data.brands,
    dimensions: parsed.data.dimensions.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      facet: dimension.facet,
      order: dimension.order,
      ...(dimension.unit ? { unit: dimension.unit } : {}),
    })),
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/catalog-types");
  revalidatePath("/admin/catalog-types/[key]", "page");
  return { ok: true };
}

// Issue #58 step B2: the type editor edits the label's translations through the one
// validated translation core — the configuration stays the German truth (`de` always
// comes from the stored config label, never from the payload).
function createCatalogTypeLabelSchema(labels: LabelMap) {
  return z.object({
    key: z
      .string()
      .trim()
      .regex(CONFIG_KEY_PATTERN, label(labels, "admin.catalogTypes.validation.keyShape")),
    texts: z.record(z.string().regex(LANGUAGE_CODE_PATTERN), z.string().trim().max(200)),
  });
}

export async function saveCatalogTypeLabelAction(
  _previous: CatalogTypeActionState | null,
  formData: FormData,
): Promise<CatalogTypeActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: label(labels, "admin.error.invalidRequest") };
  }
  const parsed = createCatalogTypeLabelSchema(labels).safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? label(labels, "admin.error.invalidRequest"),
    };
  }
  const config = await getCatalogType(parsed.data.key);
  if (!config) return { ok: false, error: label(labels, "admin.catalogTypes.notFound") };
  // #58 review: an untouched save writes nothing — no update, no de-only row.
  const stored = (await getTranslations()).find((row) => row.key === typeLabelKey(config.key));
  if (!contentSaveIsNoop(stored, config.label, parsed.data.texts)) {
    const result = await saveTranslationCore({
      key: typeLabelKey(config.key),
      area: "catalog",
      de: config.label,
      texts: parsed.data.texts,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }
  revalidatePath("/admin/catalog-types/[key]", "page");
  return { ok: true };
}
