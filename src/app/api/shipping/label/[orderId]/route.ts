import { NextResponse } from "next/server";
import { isSameOrigin } from "@/server/same-origin";
import { createLabelCore } from "@/server/shipping/label";
import { getSessionUserId } from "@/server/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  if (!isSameOrigin(request.headers.get("origin"), request.url)) {
    return NextResponse.json({ error: "Fremde Origin abgelehnt." }, { status: 403 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const { orderId } = await context.params;
  const result = await createLabelCore(orderId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, trackingNumber: result.trackingNumber });
}
