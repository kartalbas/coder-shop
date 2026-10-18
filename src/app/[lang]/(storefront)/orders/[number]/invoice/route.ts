import { NextResponse, connection } from "next/server";
import { label } from "@/lib/i18n";
import { getInvoiceFileCore } from "@/server/invoices";
import { mayViewOrderDetails } from "@/server/order-access";
import { getLabels } from "@/server/i18n";

// The invoice behind the confirmation page: same visibility rule as the order details
// themselves (access cookie, verified e-mail, owning account, or admin — issue #40).
export async function GET(
  request: Request,
  context: { params: Promise<{ lang: string; number: string }> },
): Promise<Response> {
  await connection();

  const { lang, number } = await context.params;
  if (!(await mayViewOrderDetails(number))) {
    return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(number)}`, request.url), 307);
  }

  const file = await getInvoiceFileCore(number);
  if (!file) {
    // #58 step 3: the refusal answers in the URL's language.
    const labels = await getLabels(lang);
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
