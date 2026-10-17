import { NextResponse } from "next/server";
import { createLabelCore } from "@/server/shipping/label";
import { getSessionUserId } from "@/server/session";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
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
