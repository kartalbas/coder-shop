import { NextResponse, connection } from "next/server";
import { getProductsBySlugs } from "@/server/search";

const MAX_SLUGS = 12;

// GET /api/recently-viewed?slugs=a,b,c (issue #46) — the products behind the slugs the
// browser remembered, in the requested (newest-first) order; unknown slugs are simply
// missing from the answer.
export async function GET(request: Request): Promise<NextResponse> {
  await connection();
  const raw = new URL(request.url).searchParams.get("slugs") ?? "";
  const slugs = [
    ...new Set(
      raw
        .split(",")
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0 && slug.length <= 120),
    ),
  ].slice(0, MAX_SLUGS);
  const items = await getProductsBySlugs(slugs);
  return NextResponse.json({ items });
}
