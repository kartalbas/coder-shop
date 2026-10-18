import { createFormatters } from "@/lib/format";
import { defaultLanguage, intlLocaleOf } from "@/lib/i18n";
import type { MailContext } from "@/lib/mail-templates";
import { getLabels, getLanguages } from "./i18n";

// Issue #58 decision point 3: a mail renders in the *recipient's* language — the
// language stored on the order, alert or account when the shop writes to a customer
// (admin-triggered mails included), the request language where the customer acts
// themselves. Documents predating the field carry no language and fall back to the
// first active row; texts and formats resolve from the table, never from a literal.
export async function getMailContext(language?: string): Promise<MailContext> {
  const languages = await getLanguages();
  const code = language ?? defaultLanguage(languages);
  return {
    language: code,
    labels: await getLabels(code),
    formatters: createFormatters(intlLocaleOf(languages, code)),
  };
}
