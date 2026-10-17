import { NextResponse, connection } from "next/server";
import { getLabelFileCore } from "@/server/shipping/label";
import { getSessionUserId } from "@/server/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  await connection();

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 307);
  }

  const { orderId } = await context.params;
  const result = await getLabelFileCore(orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
