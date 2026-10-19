import { NextResponse, connection } from "next/server";
import { searchProducts } from "@/server/search";
import { getRequestLabels } from "@/server/i18n";
import { searchQuerySchema } from "@/lib/validations/listing";

// Issue #58 step B1b: /api/* sits outside the proxy matcher, so there is no prefix
// header — the remembered `lang` cookie (written on every prefixed navigation) and the
// browser header decide, exactly like every server action. Matching stays on the
// stored German name/brand; the hits answer in the request language.
export async function GET(request: Request): Promise<NextResponse> {
  await connection();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = searchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const hits = await searchProducts(parsed.data.q ?? "", 8, await getRequestLabels());
  return NextResponse.json({ hits });
}
