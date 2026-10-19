"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { label, LANGUAGE_CODE_PATTERN, TRANSLATION_AREAS, type LabelMap } from "@/lib/i18n";
import { getRequestLabels, saveLanguageCore, saveTranslationCore } from "@/server/i18n";
import { requireAdminSession } from "@/server/session";

export interface TranslationActionState {
  ok?: boolean;
  error?: string;
}

// Issue #58: the admin edits the translation table and the language rows through the
// validated cores — the same write path the seed and tests use, so the cache is always
// invalidated and no unvalidated text reaches the table.

// Issue #58 step 3: both schemas are label-map factories — every message comes from the
// translation table in the request language.
function createTranslationSchema(labels: LabelMap) {
  return z.object({
    key: z
      .string()
      .trim()
      .regex(
        /^[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+)+$/,
        label(labels, "admin.translations.validation.keyShape"),
      ),
    area: z.enum(TRANSLATION_AREAS),
    de: z
      .string()
      .trim()
      .min(1, label(labels, "admin.translations.validation.deRequired"))
      .max(2000),
    texts: z.record(z.string(), z.string().trim().max(2000)),
  });
}

export async function saveTranslationAction(
  _previous: TranslationActionState | null,
  formData: FormData,
): Promise<TranslationActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: label(labels, "admin.error.invalidRequest") };
  }
  const parsed = createTranslationSchema(labels).safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? label(labels, "admin.error.invalidRequest"),
    };
  }
  const result = await saveTranslationCore(parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/translations");
  revalidatePath("/admin/translations/[key]", "page");
  return { ok: true };
}

function createLanguageSchema(labels: LabelMap) {
  return z.object({
    code: z
      .string()
      .trim()
      .regex(LANGUAGE_CODE_PATTERN, label(labels, "admin.languages.validation.codeShape")),
    label: z
      .string()
      .trim()
      .min(1, label(labels, "admin.languages.validation.nameRequired"))
      .max(60),
    intlLocale: z
      .string()
      .trim()
      .min(1, label(labels, "admin.languages.validation.localeRequired"))
      .max(20),
    position: z.coerce.number().int().min(0).max(999),
    active: z.boolean(),
  });
}

export async function saveLanguageAction(
  _previous: TranslationActionState | null,
  formData: FormData,
): Promise<TranslationActionState> {
  await requireAdminSession();
  const labels = await getRequestLabels();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: label(labels, "admin.error.invalidRequest") };
  }
  const parsed = createLanguageSchema(labels).safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? label(labels, "admin.error.invalidRequest"),
    };
  }
  const result = await saveLanguageCore(parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/translations/languages");
  revalidatePath("/admin/translations");
  return { ok: true };
}
