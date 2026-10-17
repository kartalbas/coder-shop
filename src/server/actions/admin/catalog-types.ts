"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveCatalogTypeCore } from "@/server/catalog-types";
import { requireAdminSession } from "@/server/session";

export interface CatalogTypeActionState {
  ok?: boolean;
  error?: string;
}

const dimensionKey = z
  .string()
  .trim()
  .regex(/^[a-z][a-zA-Z0-9]*$/, "Dimensions-Key: Kleinbuchstabe, dann Buchstaben/Ziffern.");

const catalogTypeSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9-]*$/, "Key: Kleinbuchstaben, Ziffern, Bindestriche."),
  label: z.string().trim().min(1, "Name fehlt."),
  position: z.coerce.number().int().min(0).max(999),
  stockTracking: z.enum(["quantity", "serial"]),
  comparable: z.boolean(),
  photoNoun: z.string().trim().min(1, "Foto-Beschreibung fehlt."),
  brands: z.array(z.string().trim().min(1).max(60)),
  dimensions: z
    .array(
      z.object({
        key: dimensionKey,
        label: z.string().trim().min(1, "Dimensions-Name fehlt."),
        facet: z.boolean(),
        order: z.enum(["alpha", "numeric", "clothing-size"]),
        unit: z.string().trim().max(12),
      }),
    )
    .min(1, "Mindestens eine Dimension ist nötig."),
});

// Issue #64: the admin edits the catalog type configuration (#61 rows) through the
// validated core — the same write path the seed and tests use.
export async function saveCatalogTypeAction(
  _previous: CatalogTypeActionState | null,
  formData: FormData,
): Promise<CatalogTypeActionState> {
  await requireAdminSession();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Ungültige Eingaben." };
  }
  const parsed = catalogTypeSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
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
