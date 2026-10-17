"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  addressIdSchema,
  addressSchema,
  claimOrderSchema,
  customerLoginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerFieldsSchema,
  validateCustomerPassword,
} from "@/lib/validations/account";
import { fieldErrorsFrom } from "@/lib/validations/common";
import {
  claimOrderCore,
  deleteAddressCore,
  registerCustomerCore,
  requestPasswordResetCore,
  RESET_SENT,
  resetPasswordCore,
  saveAddressCore,
} from "@/server/customers";
import {
  changePasswordCore,
  clearSessionCookie,
  customerLoginCore,
  getCustomerSessionUserId,
  requireCustomerSession,
  resolveClientIp,
  revokeSessionsCore,
  setSessionCookie,
} from "@/server/session";
import { env } from "@/server/env";
import { getReorderLinesCore, type ReorderLine } from "@/server/account";

export interface AccountActionState {
  ok: boolean;
  error?: string;
  message?: string;
  // Issue #60: the message of the field the error belongs to, keyed by field name.
  fieldErrors?: Record<string, string>;
}

async function clientIp(): Promise<string> {
  const all = await headers();
  return resolveClientIp((name) => all.get(name), env.trustProxyHeaders);
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Bitte Eingaben prüfen.";
}

function invalidForm(error: z.ZodError): AccountActionState {
  return { ok: false, error: firstIssue(error), fieldErrors: fieldErrorsFrom(error) };
}

function parseForm<T extends z.ZodType>(schema: T, formData: FormData) {
  const raw = Object.fromEntries(formData);
  return schema.safeParse(raw);
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

export async function registerAction(
  _previous: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = parseForm(registerFieldsSchema, formData);
  if (!parsed.success) return invalidForm(parsed.error);
  const result = await registerCustomerCore(
    { ...parsed.data, consent: checkbox(formData.get("consent")) },
    { ip: await clientIp() },
  );
  if (!result.ok) {
    // The e-mail is the field the user can still correct here (issue #60).
    const isEmailTaken = result.error.includes("E-Mail");
    return {
      ok: false,
      error: result.error,
      fieldErrors: isEmailTaken ? { email: result.error } : undefined,
    };
  }
  const login = await customerLoginCore(parsed.data.email, parsed.data.password, {
    ip: await clientIp(),
  });
  if (login.ok) await setSessionCookie(login.token, "customer");
  redirect("/konto");
}

export async function customerLoginAction(
  _previous: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = parseForm(customerLoginSchema, formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await customerLoginCore(parsed.data.email, parsed.data.password, {
    ip: await clientIp(),
  });
  if (!result.ok) return { ok: false, error: result.error };
  await setSessionCookie(result.token, "customer");
  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/konto");
}

export async function customerLogoutAction(): Promise<void> {
  const userId = await getCustomerSessionUserId();
  if (userId) await revokeSessionsCore(userId);
  await clearSessionCookie("customer");
  redirect("/");
}

export async function passwordResetRequestAction(
  _previous: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = parseForm(passwordResetRequestSchema, formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await requestPasswordResetCore(parsed.data.email, { ip: await clientIp() });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: RESET_SENT };
}

export async function passwordResetConfirmAction(
  _previous: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = parseForm(passwordResetConfirmSchema, formData);
  if (!parsed.success) return invalidForm(parsed.error);
  const result = await resetPasswordCore(parsed.data.token, parsed.data.password);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Das Passwort wurde geändert. Sie können sich jetzt anmelden." };
}

export async function claimOrderAction(
  _previous: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = await getCustomerSessionUserId();
  if (!userId) return { ok: false, error: "Bitte zuerst anmelden." };
  const parsed = parseForm(claimOrderSchema, formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await claimOrderCore(userId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: `Bestellung ${result.orderNumber} wurde Ihrem Konto hinzugefügt.` };
}

export async function saveAddressAction(
  _previous: AccountActionState | null,
  formData: FormData,
): Promise<AccountActionState> {
  const userId = await getCustomerSessionUserId();
  if (!userId) return { ok: false, error: "Bitte zuerst anmelden." };
  const parsed = parseForm(addressSchema, formData);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const rawId = formData.get("addressId");
  let addressId: string | undefined;
  if (typeof rawId === "string" && rawId) {
    const parsedId = addressIdSchema.safeParse(rawId);
    if (!parsedId.success) return { ok: false, error: "Ungültige Adresse." };
    addressId = parsedId.data;
  }
  const result = await saveAddressCore(userId, parsed.data, addressId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Adresse gespeichert." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const userId = await getCustomerSessionUserId();
  if (!userId) return;
  const parsedId = addressIdSchema.safeParse(formData.get("addressId"));
  if (!parsedId.success) return;
  await deleteAddressCore(userId, parsedId.data);
}

export async function reorderAction(orderNumber: string): Promise<ReorderLine[]> {
  const userId = await getCustomerSessionUserId();
  if (!userId) return [];
  return (await getReorderLinesCore(userId, orderNumber)) ?? [];
}

// Changing your own password signs every session out (sessionsInvalidBefore) — the
// customer has to log in again with the new one.
export interface ChangeOwnPasswordActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function changePasswordAction(
  _previous: ChangeOwnPasswordActionState | null,
  formData: FormData,
): Promise<ChangeOwnPasswordActionState> {
  const userId = await requireCustomerSession();
  const password = String(formData.get("newPassword") ?? "");
  const passwordError = validateCustomerPassword(password);
  if (passwordError) {
    return { error: passwordError, fieldErrors: { newPassword: passwordError } };
  }
  const result = await changePasswordCore(
    userId,
    String(formData.get("currentPassword") ?? ""),
    password,
  );
  if (!result.ok) {
    const field = result.reason === "current_password" ? "currentPassword" : "newPassword";
    return { error: result.error, fieldErrors: { [field]: result.error } };
  }
  redirect("/konto/anmelden");
}
