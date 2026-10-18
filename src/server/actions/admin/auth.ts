"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearSessionCookie,
  loginCore,
  requireAdminSession,
  resolveClientIp,
  revokeSessionsCore,
  setSessionCookie,
} from "@/server/session";
import { env } from "@/server/env";
import { label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";

export interface LoginActionState {
  error?: string;
}

// Issue #58 admin slice: the form schema is built from the request language's label
// map, so a refusal answers in the language of the login page.
function loginFormSchema(labels: Record<string, string>) {
  return z.object({
    email: z.email(label(labels, "admin.login.emailInvalid")),
    password: z.string().min(1, label(labels, "admin.login.passwordRequired")),
  });
}

async function clientIp(): Promise<string> {
  const all = await headers();
  return resolveClientIp((name) => all.get(name), env.trustProxyHeaders);
}

export async function loginAction(
  _previous: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const labels = await getRequestLabels();
  const parsed = loginFormSchema(labels).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm"),
    };
  }

  const result = await loginCore(parsed.data.email, parsed.data.password, {
    ip: await clientIp(),
  });
  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.token);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  // Revoke server-side first: deleting only the cookie would leave the token valid for
  // its full 12 h — a captured copy would still work.
  const userId = await requireAdminSession();
  await revokeSessionsCore(userId);
  await clearSessionCookie();
  redirect("/admin/login");
}
