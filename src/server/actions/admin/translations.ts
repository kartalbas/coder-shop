"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TRANSLATION_AREAS } from "@/lib/i18n";
import { saveLanguageCore, saveTranslationCore } from "@/server/i18n";
import { requireAdminSession } from "@/server/session";

export interface TranslationActionState {
  ok?: boolean;
  error?: string;
}

// Issue #58: the admin edits the translation table and the language rows through the
// validated cores — the same write path the seed and tests use, so the cache is always
// invalidated and no unvalidated text reaches the table.

const translationSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+)+$/, "Übersetzungs-Key ungültig (z. B. shop.cart.title)."),
  area: z.enum(TRANSLATION_AREAS),
  de: z.string().trim().min(1, "Deutscher Basistext fehlt.").max(2000),
  texts: z.record(z.string(), z.string().trim().max(2000)),
});

export async function saveTranslationAction(
  _previous: TranslationActionState | null,
  formData: FormData,
): Promise<TranslationActionState> {
  await requireAdminSession();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Ungültige Eingaben." };
  }
  const parsed = translationSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const result = await saveTranslationCore(parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/translations");
  revalidatePath("/admin/translations/[key]", "page");
  return { ok: true };
}

const languageSchema = z.object({
  code: z.string().trim().regex(/^[a-z]{2,3}$/, "Sprachcode: 2–3 Kleinbuchstaben."),
  label: z.string().trim().min(1, "Sprachname fehlt.").max(60),
  intlLocale: z.string().trim().min(1, "Intl-Locale fehlt.").max(20),
  position: z.coerce.number().int().min(0).max(999),
  active: z.boolean(),
});

export async function saveLanguageAction(
  _previous: TranslationActionState | null,
  formData: FormData,
): Promise<TranslationActionState> {
  await requireAdminSession();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Ungültige Eingaben." };
  }
  const parsed = languageSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const result = await saveLanguageCore(parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/translations/languages");
  revalidatePath("/admin/translations");
  return { ok: true };
}
