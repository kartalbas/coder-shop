import { NextResponse, connection } from "next/server";
import { listProducts } from "@/server/search";
import { listingParamsSchema } from "@/lib/validations/listing";

export async function GET(request: Request): Promise<NextResponse> {
  await connection();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listingParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }
  const result = await listProducts(parsed.data);
  return NextResponse.json(result);
}
