import { connection } from "next/server";
import { vatLabel } from "@/lib/shop-settings";
import { getShopSettings } from "@/server/shop-settings";

// Issue #64: the VAT wording is configured data — rendered in a dynamic hole so the
// static shell of the page survives (#37 rule: unwrap the request first).
export async function VatLabel() {
  await connection();
  const settings = await getShopSettings();
  return <>{vatLabel(settings.vatRatePercent)}</>;
}
