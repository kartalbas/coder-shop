"use server";

import { cookies } from "next/headers";
import { LANGUAGE_COOKIE } from "@/lib/i18n";
import { getActiveLanguages } from "@/server/i18n";

// Issue #58 admin slice: the admin switcher writes the shared `lang` cookie — the same
// name and options the proxy writes on prefixed storefront navigations, so the choice
// is remembered everywhere and read back by getRequestLanguage(). One writer per
// surface: the proxy never touches /admin/* language logic, so the two can never
// fight over the cookie. Unknown or deactivated codes are refused without writing —
// the language set stays data (a new row appears in the switcher without a code change).
export async function setLanguageAction(code: string): Promise<void> {
  const languages = await getActiveLanguages();
  if (!languages.some((language) => language.code === code)) return;
  const store = await cookies();
  store.set(LANGUAGE_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
