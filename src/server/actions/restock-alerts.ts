"use server";

import { z } from "zod";
import { subscribeRestockAlertCore } from "@/server/restock-alerts";

// "Benachrichtigen, wenn wieder verfügbar" (issue #46) — guests included, the e-mail
// address is the whole relationship.

const inputSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  email: z.email("Bitte eine gültige E-Mail-Adresse angeben.").max(254),
});

export type RestockAlertResult =
  | { ok: true; inStock: boolean }
  | { ok: false; error: string };

export async function subscribeRestockAlertAction(
  rawSku: unknown,
  rawEmail: unknown,
): Promise<RestockAlertResult> {
  const parsed = inputSchema.safeParse({ sku: rawSku, email: rawEmail });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  return subscribeRestockAlertCore(parsed.data.sku, parsed.data.email);
}
