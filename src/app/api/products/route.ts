import { NextResponse, connection } from "next/server";
import { listProducts } from "@/server/search";
import { getCatalogTypes } from "@/server/catalog-types";
import { parseListingParams } from "@/lib/validations/listing";

// JSON listing API (ARCHITECTURE §4). Issue #61: facet params are validated against the
// catalog type configuration; junk falls back to unset like the page does (issue #32).
export async function GET(request: Request): Promise<NextResponse> {
  await connection();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const types = await getCatalogTypes();
  const result = await listProducts(parseListingParams(params, types));
  return NextResponse.json(result);
}
