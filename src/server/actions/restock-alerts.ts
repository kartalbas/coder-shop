"use server";

import { z } from "zod";
import { label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { subscribeRestockAlertCore } from "@/server/restock-alerts";

// "Benachrichtigen, wenn wieder verfügbar" (issue #46) — guests included, the e-mail
// address is the whole relationship. The form sits on the public product page, so its
// messages follow the request language (#58).

function createRestockAlertSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    sku: z.string().trim().min(1).max(64),
    email: z.email(label(labels, "shop.restock.error.email")).max(254),
  });
}

export type RestockAlertResult =
  | { ok: true; inStock: boolean }
  | { ok: false; error: string };

export async function subscribeRestockAlertAction(
  rawSku: unknown,
  rawEmail: unknown,
): Promise<RestockAlertResult> {
  const labels = await getRequestLabels();
  const parsed = createRestockAlertSchema(labels).safeParse({ sku: rawSku, email: rawEmail });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm") };
  }
  return subscribeRestockAlertCore(parsed.data.sku, parsed.data.email);
}
