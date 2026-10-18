"use server";

import { z } from "zod";
import { interpolate, label } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH, passwordRulesMet } from "@/lib/password-rules";
import { fieldErrorsFrom } from "@/lib/validations/common";
import { getRequestLabels } from "@/server/i18n";
import { changePasswordCore, requireAdminSession } from "@/server/session";

export interface ChangePasswordActionState {
  ok: boolean;
  error?: string;
  // Issue #60: the message of the field the error belongs to, keyed by field name.
  fieldErrors?: Record<string, string>;
}

// Issue #58 step 2 (review nit): the schema is a label-map factory — the messages come
// from the translation table in the request language, the length message reuses the
// login row with MIN_PASSWORD_LENGTH, the fallback the established shop.action.invalidForm.
function createChangePasswordSchema(labels: Readonly<Record<string, string>>) {
  return z
    .object({
      current: z.string().min(1, label(labels, "admin.account.currentRequired")),
      // Same rules the live checklist shows (issue #60, src/lib/password-rules.ts).
      next: z
        .string()
        .refine(
          (value) => passwordRulesMet("admin", value),
          interpolate(label(labels, "admin.auth.error.passwordTooShort"), {
            min: MIN_PASSWORD_LENGTH,
          }),
        ),
      confirm: z.string(),
    })
    .refine((data) => data.next === data.confirm, {
      message: label(labels, "admin.account.passwordMismatch"),
      path: ["confirm"],
    });
}

export async function changePasswordAction(
  _previous: ChangePasswordActionState | null,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const userId = await requireAdminSession();
  const labels = await getRequestLabels();
  const parsed = createChangePasswordSchema(labels).safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm"),
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const result = await changePasswordCore(userId, parsed.data.current, parsed.data.next);
  if (!result.ok) {
    const field = result.reason === "current_password" ? "current" : "next";
    return { ok: false, error: result.error, fieldErrors: { [field]: result.error } };
  }
  return result;
}
