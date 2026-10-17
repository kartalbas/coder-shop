import { NextResponse, connection } from "next/server";
import { searchProducts } from "@/server/search";
import { searchQuerySchema } from "@/lib/validations/listing";

export async function GET(request: Request): Promise<NextResponse> {
  await connection();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = searchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const hits = await searchProducts(parsed.data.q ?? "");
  return NextResponse.json({ hits });
}
