import fs from "node:fs/promises";
import mongoose from "mongoose";
import { NextResponse, connection } from "next/server";
import { OrderModel } from "@/models/order";
import { connectDB } from "@/server/db";
import { resolveInsideDir } from "@/server/secure-path";
import { LABELS_DIR } from "@/server/shipping/label";
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
  if (!mongoose.isValidObjectId(orderId)) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  await connectDB();
  const order = await OrderModel.findById(orderId).select("orderNumber shipping.labelPath").lean().exec();
  if (!order?.shipping.labelPath) {
    return NextResponse.json({ error: "Kein Etikett vorhanden." }, { status: 404 });
  }

  const file = resolveInsideDir(LABELS_DIR, order.shipping.labelPath);
  if (!file) {
    return NextResponse.json({ error: "Ungültiger Etiketten-Pfad." }, { status: 400 });
  }

  let pdf: Buffer;
  try {
    pdf = await fs.readFile(file);
  } catch {
    return NextResponse.json({ error: "Etikettdatei fehlt auf dem Server." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
