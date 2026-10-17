import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { formatChf, formatDate } from "@/lib/format";
import { QR_BILL_CREDITOR, openAmountCents, qrBillPayload } from "@/lib/invoices";
import { VAT_INCLUSIVE_NOTE } from "@/lib/pricing";
import type { Order } from "@/models/order";

// Invoice PDF with a Swiss QR-bill section (issue #40): the QR encodes the standard
// SPC payload with the order's QRR reference, so a banking app can take the payment.
export async function buildInvoicePdf(order: Order): Promise<Uint8Array> {
  const invoice = order.payment.invoice;
  if (!invoice) throw new Error(`Order ${order.orderNumber} has no invoice`);
  const openCents = openAmountCents(order.totals.totalCents, invoice.paidCents);

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
  page.drawText("Rechnung", { x: 50, y, size: 22, font: bold, color: ink });
  y -= 22;
  page.drawText(`Bestellung ${order.orderNumber}`, { x: 50, y, size: 11, font, color: ink });
  y -= 16;
  page.drawText(`Rechnungsdatum ${formatDate(order.createdAt)}`, { x: 50, y, size: 11, font, color: ink });
  y -= 16;
  page.drawText(`Zahlbar bis ${formatDate(invoice.dueAt)}`, { x: 50, y, size: 11, font, color: ink });

  y -= 30;
  page.drawText("Rechnungsempfänger", { x: 50, y, size: 10, font: bold, color: muted });
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
  page.drawText("Positionen", { x: 50, y, size: 10, font: bold, color: muted });
  y -= 18;
  for (const line of order.lines) {
    const label = `${line.qty}× ${line.name} (${line.variantLabel})`;
    page.drawText(label.slice(0, 70), { x: 50, y, size: 10, font, color: ink });
    page.drawText(formatChf(line.totalCents), { x: 465, y, size: 10, font, color: ink });
    y -= 15;
  }

  y -= 8;
  page.drawLine({
    start: { x: 50, y: y + 6 },
    end: { x: 545, y: y + 6 },
    thickness: 0.75,
    color: rgb(0.85, 0.85, 0.87),
  });
  y -= 12;
  const totals: [string, string][] = [
    ["Zwischensumme", formatChf(order.totals.subtotalCents)],
    ["Versand", order.totals.shippingCents === 0 ? "Gratis" : formatChf(order.totals.shippingCents)],
    ["Total", formatChf(order.totals.totalCents)],
  ];
  if (invoice.paidCents > 0) {
    totals.push(["Erhalten", `− ${formatChf(invoice.paidCents)}`]);
    totals.push(["Offen", formatChf(openCents)]);
  }
  for (const [label, value] of totals) {
    const isTotal = label === "Total" || label === "Offen";
    page.drawText(label, { x: 380, y, size: 11, font: isTotal ? bold : font, color: ink });
    page.drawText(value, { x: 465, y, size: 11, font: isTotal ? bold : font, color: ink });
    y -= 16;
  }
  page.drawText(VAT_INCLUSIVE_NOTE, { x: 380, y, size: 9, font, color: muted });

  // QR-bill section at the bottom of the page.
  const qrTop = 250;
  page.drawRectangle({ x: 50, y: 40, width: 495, height: qrTop - 40, color: rgb(0.97, 0.97, 0.98) });
  page.drawLine({
    start: { x: 300, y: 40 },
    end: { x: 300, y: qrTop },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.78),
  });
  page.drawText("Empfangsschein", { x: 62, y: qrTop - 22, size: 10, font: bold, color: muted });
  page.drawText("Zahlteil", { x: 312, y: qrTop - 22, size: 10, font: bold, color: muted });

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

  page.drawText("Währung / Betrag", { x: 62, y: qrTop - 46, size: 8, font, color: muted });
  page.drawText("CHF", { x: 62, y: qrTop - 62, size: 11, font, color: ink });
  page.drawText(formatChf(openCents), { x: 110, y: qrTop - 62, size: 13, font: bold, color: ink });
  page.drawText("Konto / Zahlbar an", { x: 62, y: qrTop - 84, size: 8, font, color: muted });
  page.drawText(QR_BILL_CREDITOR.iban, { x: 62, y: qrTop - 100, size: 10, font, color: ink });
  page.drawText(QR_BILL_CREDITOR.name, { x: 62, y: qrTop - 114, size: 10, font, color: ink });
  page.drawText(`${QR_BILL_CREDITOR.postalCode} ${QR_BILL_CREDITOR.city}`, {
    x: 62,
    y: qrTop - 128,
    size: 10,
    font,
    color: ink,
  });
  page.drawText("Referenz", { x: 62, y: qrTop - 150, size: 8, font, color: muted });
  page.drawText(invoice.qrReference, { x: 62, y: qrTop - 166, size: 10, font, color: ink });
  page.drawText("Zahlbar durch", { x: 62, y: qrTop - 188, size: 8, font, color: muted });
  page.drawText(order.customer.name, { x: 62, y: qrTop - 204, size: 10, font, color: ink });
  page.drawText(" coder-shop · Swiss QR-Rechnung (Demo)", { x: 312, y: 44, size: 8, font, color: muted });

  return doc.save();
}
