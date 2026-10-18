import { NextResponse, connection } from "next/server";
import { label } from "@/lib/i18n";
import { getInvoiceFileByIdCore } from "@/server/invoices";
import { getRequestLabels } from "@/server/i18n";
import { getSessionUserId } from "@/server/session";

// Invoice PDFs contain customer PII — admin session only (same rule as labels, issue #40).
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
  const file = await getInvoiceFileByIdCore(orderId);
  if (!file) {
    // #58 step 3: the refusal answers in the admin's language (shared `lang` cookie).
    const labels = await getRequestLabels();
    return NextResponse.json({ error: label(labels, "shop.invoice.notFound") }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
