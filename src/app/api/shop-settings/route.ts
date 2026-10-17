import { getShopSettings } from "@/server/shop-settings";

// Issue #64: the public commerce configuration (VAT rate, shipping methods and prices,
// payment methods) for the storefront client components. No personal data, cacheable
// for a minute so a browsing session fetches it once.
export async function GET(): Promise<Response> {
  const settings = await getShopSettings();
  return Response.json(settings, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
