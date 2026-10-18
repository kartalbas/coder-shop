import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { interpolate, label } from "@/lib/i18n";
import type { MailContext } from "@/lib/mail-templates";
import { QR_BILL_CREDITOR, openAmountCents, qrBillPayload } from "@/lib/invoices";
import { vatLabel } from "@/lib/shop-settings";
import type { Order } from "@/models/order";

// Invoice PDF with a Swiss QR-bill section (issue #40): the QR encodes the standard
// SPC payload with the order's QRR reference, so a banking app can take the payment.
// The VAT note is configured data (issue #64). #58 decision point 3: every drawn text
// is an `invoice.pdf.*` row (or a reused shop row) and every amount/date follows the
// Intl set of the *order's* stored language — the document answers the customer, not
// the requester. The SPC payload inside the QR stays German: it is banking interop
// data a clearing system reads, not UI text (DECISIONS).
export async function buildInvoicePdf(
  order: Order,
  vatRatePercent: number,
  ctx: MailContext,
): Promise<Uint8Array> {
  const invoice = order.payment.invoice;
  if (!invoice) throw new Error(`Order ${order.orderNumber} has no invoice`);
  const openCents = openAmountCents(order.totals.totalCents, invoice.paidCents);
  const t = (key: string) => label(ctx.labels, key);
  const chf = ctx.formatters.chf;
  const date = ctx.formatters.date;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const ink = rgb(0.09, 0.09, 0.11);
  const muted = rgb(0.44, 0.44, 0.48);

  let y = height - 60;
  page.drawText("coder-shop", { x: 50, y, size: 16, font: bold, color: ink });
  y -= 34;
  page.drawText(t("invoice.pdf.title"), { x: 50, y, size: 22, font: bold, color: ink });
  y -= 22;
  page.drawText(interpolate(t("invoice.pdf.order"), { number: order.orderNumber }), {
    x: 50,
    y,
    size: 11,
    font,
    color: ink,
  });
  y -= 16;
  page.drawText(interpolate(t("invoice.pdf.issued"), { date: date(order.createdAt) }), {
    x: 50,
    y,
    size: 11,
    font,
    color: ink,
  });
  y -= 16;
  page.drawText(interpolate(t("invoice.pdf.due"), { date: date(invoice.dueAt) }), {
    x: 50,
    y,
    size: 11,
    font,
    color: ink,
  });

  y -= 30;
  page.drawText(t("invoice.pdf.billTo"), { x: 50, y, size: 10, font: bold, color: muted });
  y -= 15;
  for (const line of [
    order.customer.name,
    order.customer.street,
    `${order.customer.postalCode} ${order.customer.city}`,
  ]) {
    page.drawText(line, { x: 50, y, size: 11, font, color: ink });
    y -= 15;
  }

  y -= 18;
  page.drawText(t("invoice.pdf.positions"), { x: 50, y, size: 10, font: bold, color: muted });
  y -= 18;
  for (const line of order.lines) {
    const text = interpolate(t("invoice.pdf.line"), {
      qty: line.qty,
      name: line.name,
      variant: line.variantLabel,
    });
    page.drawText(text.slice(0, 70), { x: 50, y, size: 10, font, color: ink });
    page.drawText(chf(line.totalCents), { x: 465, y, size: 10, font, color: ink });
    y -= 15;
    // Issue #62 (#54): serial-tracked pieces are itemised on the invoice.
    if (line.serials && line.serials.length > 0) {
      page.drawText(
        interpolate(t("invoice.pdf.serials"), { serials: line.serials.join(", ") }).slice(0, 90),
        { x: 60, y, size: 8, font, color: muted },
      );
      y -= 12;
    }
  }

  y -= 8;
  page.drawLine({
    start: { x: 50, y: y + 6 },
    end: { x: 545, y: y + 6 },
    thickness: 0.75,
    color: rgb(0.85, 0.85, 0.87),
  });
  y -= 12;
  const totals: { label: string; value: string; strong: boolean }[] = [
    { label: t("invoice.pdf.subtotal"), value: chf(order.totals.subtotalCents), strong: false },
    // Issue #45: a booked discount code is a line on the invoice too. The minus is an
    // ASCII hyphen — pdf-lib's WinAnsi font cannot encode U+2212 (latent crash before
    // this slice, which is why these two lines are not byte-identity-bound).
    ...(order.discount && order.discount.cents > 0
      ? [
          {
            label: interpolate(t("invoice.pdf.discount"), { code: order.discount.code }),
            value: `- ${chf(order.discount.cents)}`,
            strong: false,
          },
        ]
      : []),
    {
      label: t("invoice.pdf.shipping"),
      value:
        order.totals.shippingCents === 0
          ? label(ctx.labels, "shop.checkout.free")
          : chf(order.totals.shippingCents),
      strong: false,
    },
    { label: t("invoice.pdf.total"), value: chf(order.totals.totalCents), strong: true },
  ];
  if (invoice.paidCents > 0) {
    totals.push({ label: t("invoice.pdf.received"), value: `- ${chf(invoice.paidCents)}`, strong: false });
    totals.push({ label: t("invoice.pdf.open"), value: chf(openCents), strong: true });
  }
  for (const entry of totals) {
    const fontFor = entry.strong ? bold : font;
    page.drawText(entry.label, { x: 380, y, size: 11, font: fontFor, color: ink });
    page.drawText(entry.value, { x: 465, y, size: 11, font: fontFor, color: ink });
    y -= 16;
  }
  page.drawText(
    interpolate(label(ctx.labels, "shop.checkout.vatNote"), { vat: vatLabel(vatRatePercent) }),
    { x: 380, y, size: 9, font, color: muted },
  );

  // QR-bill section at the bottom of the page.
  const qrTop = 250;
  page.drawRectangle({ x: 50, y: 40, width: 495, height: qrTop - 40, color: rgb(0.97, 0.97, 0.98) });
  page.drawLine({
    start: { x: 300, y: 40 },
    end: { x: 300, y: qrTop },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.78),
  });
  page.drawText(t("invoice.pdf.receipt"), { x: 62, y: qrTop - 22, size: 10, font: bold, color: muted });
  page.drawText(t("invoice.pdf.paymentPart"), { x: 312, y: qrTop - 22, size: 10, font: bold, color: muted });

  const qrPng = await QRCode.toBuffer(
    qrBillPayload({
      amountCents: openCents,
      reference: invoice.qrReference,
      debtorName: order.customer.name,
      additionalInformation: `Bestellung ${order.orderNumber}`,
    }),
    { type: "png", margin: 1, width: 180 },
  );
  const qrImage = await doc.embedPng(qrPng);
  page.drawImage(qrImage, { x: 312, y: 52, width: 150, height: 150 });

  page.drawText(t("invoice.pdf.currencyAmount"), { x: 62, y: qrTop - 46, size: 8, font, color: muted });
  page.drawText("CHF", { x: 62, y: qrTop - 62, size: 11, font, color: ink });
  page.drawText(chf(openCents), { x: 110, y: qrTop - 62, size: 13, font: bold, color: ink });
  page.drawText(t("invoice.pdf.creditor"), { x: 62, y: qrTop - 84, size: 8, font, color: muted });
  page.drawText(QR_BILL_CREDITOR.iban, { x: 62, y: qrTop - 100, size: 10, font, color: ink });
  page.drawText(QR_BILL_CREDITOR.name, { x: 62, y: qrTop - 114, size: 10, font, color: ink });
  page.drawText(`${QR_BILL_CREDITOR.postalCode} ${QR_BILL_CREDITOR.city}`, {
    x: 62,
    y: qrTop - 128,
    size: 10,
    font,
    color: ink,
  });
  page.drawText(t("invoice.pdf.reference"), { x: 62, y: qrTop - 150, size: 8, font, color: muted });
  page.drawText(invoice.qrReference, { x: 62, y: qrTop - 166, size: 10, font, color: ink });
  page.drawText(t("invoice.pdf.payableBy"), { x: 62, y: qrTop - 188, size: 8, font, color: muted });
  page.drawText(order.customer.name, { x: 62, y: qrTop - 204, size: 10, font, color: ink });
  page.drawText(t("invoice.pdf.demoFooter"), { x: 312, y: 44, size: 8, font, color: muted });

  return doc.save();
}
