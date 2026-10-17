"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSessionCookie, loginCore, setSessionCookie } from "@/server/session";

export interface LoginActionState {
  error?: string;
}

const loginFormSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail eingeben."),
  password: z.string().min(1, "Bitte Passwort eingeben."),
});

async function clientIp(): Promise<string> {
  const all = await headers();
  const forwarded = all.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || all.get("x-real-ip") || "local";
}

export async function loginAction(
  _previous: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  }

  const result = await loginCore(parsed.data.email, parsed.data.password, {
    ip: await clientIp(),
  });
  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.token);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/admin/login");
}
