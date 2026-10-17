"use server";

import { z } from "zod";
import { changePasswordCore, requireAdminSession } from "@/server/session";

export interface ChangePasswordActionState {
  ok: boolean;
  error?: string;
}

const schema = z
  .object({
    current: z.string().min(1, "Bitte das aktuelle Passwort eingeben."),
    next: z.string().min(10, "Das neue Passwort braucht mindestens 10 Zeichen."),
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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  }
  return changePasswordCore(userId, parsed.data.current, parsed.data.next);
}
