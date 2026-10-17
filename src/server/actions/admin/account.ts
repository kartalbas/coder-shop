"use server";

import { z } from "zod";
import { MIN_PASSWORD_LENGTH, passwordRulesMet } from "@/lib/password-rules";
import { fieldErrorsFrom } from "@/lib/validations/common";
import { changePasswordCore, requireAdminSession } from "@/server/session";

export interface ChangePasswordActionState {
  ok: boolean;
  error?: string;
  // Issue #60: the message of the field the error belongs to, keyed by field name.
  fieldErrors?: Record<string, string>;
}

const schema = z
  .object({
    current: z.string().min(1, "Bitte das aktuelle Passwort eingeben."),
    // Same rules the live checklist shows (issue #60, src/lib/password-rules.ts).
    next: z
      .string()
      .refine(
        (value) => passwordRulesMet("admin", value),
        `Das neue Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`,
      ),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["confirm"],
  });

export async function changePasswordAction(
  _previous: ChangePasswordActionState | null,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const userId = await requireAdminSession();
  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.",
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
