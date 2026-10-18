import { NextResponse, connection } from "next/server";
import { getInvoiceFileCore } from "@/server/invoices";
import { mayViewOrderDetails } from "@/server/order-access";

// The invoice behind the confirmation page: same visibility rule as the order details
// themselves (access cookie, verified e-mail, owning account, or admin — issue #40).
export async function GET(
  request: Request,
  context: { params: Promise<{ number: string }> },
): Promise<Response> {
  await connection();

  const { number } = await context.params;
  if (!(await mayViewOrderDetails(number))) {
    return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(number)}`, request.url), 307);
  }

  const file = await getInvoiceFileCore(number);
  if (!file) {
    return NextResponse.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
