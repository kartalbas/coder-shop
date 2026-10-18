import { connection } from "next/server";
import { getShopSettings } from "@/server/shop-settings";

// Issue #64: the public commerce configuration (VAT rate, shipping methods and prices,
// payment methods) for the storefront client components. No personal data, cacheable
// for a minute so a browsing session fetches it once.
// connection() keeps the route dynamic: without it the build prerendered the settings
// into static JSON (admin edits never arrived) and booted the embedded MongoDB during
// prerendering — the build worker is killed without cleanup and orphaned the mongod on
// data/mongo, which broke every later start (recurring gate failure).
export async function GET(): Promise<Response> {
  await connection();
  const settings = await getShopSettings();
  return Response.json(settings, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
