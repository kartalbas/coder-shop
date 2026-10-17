import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { LabelRequest, LabelResult, ShippingProvider } from "@/lib/shipping/types";

const TRACKING_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const TRACKING_LENGTH = 16;

export function mockTrackingNumber(random: () => number = Math.random): string {
  let rest = "";
  for (let i = 0; i < TRACKING_LENGTH; i++) {
    rest += TRACKING_ALPHABET[Math.floor(random() * TRACKING_ALPHABET.length)];
  }
  return `1Z${rest}`;
}

async function renderMockLabelPdf(request: LabelRequest, trackingNumber: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 600]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("UPS", { x: 24, y: 566, size: 28, font: bold, color: rgb(0.35, 0.2, 0.05) });
  page.drawText("Mock-Versandetikett (Demo)", { x: 24, y: 544, size: 10, font });
  page.drawRectangle({ x: 24, y: 520, width: 352, height: 2, color: rgb(0.2, 0.2, 0.2) });

  page.drawText("Empfänger / Ship To", { x: 24, y: 496, size: 9, font: bold });
  const recipientLines = [
    request.recipient.name,
    request.recipient.street,
    `${request.recipient.postalCode} ${request.recipient.city}`,
    request.recipient.country,
  ];
  recipientLines.forEach((line, index) => {
    page.drawText(line, { x: 24, y: 480 - index * 14, size: 11, font });
  });

  page.drawText(`Bestellung: ${request.orderNumber}`, { x: 24, y: 410, size: 10, font });
  page.drawText(`Versand: ${request.service === "express" ? "UPS Express" : "UPS Standard"}`, {
    x: 24,
    y: 396,
    size: 10,
    font,
  });
  page.drawText(`Gewicht: ${(request.parcelWeightGrams / 1000).toFixed(2)} kg`, {
    x: 24,
    y: 382,
    size: 10,
    font,
  });

  page.drawText("Tracking", { x: 24, y: 340, size: 9, font: bold });
  page.drawText(trackingNumber, { x: 24, y: 318, size: 20, font: bold });
  page.drawText("1Z" + trackingNumber.slice(2, 10) + " " + trackingNumber.slice(10), {
    x: 24,
    y: 296,
    size: 12,
    font,
  });

  page.drawText("Kein echtes UPS-Etikett — nur für die lokale Demo ohne UPS-Zugang.", {
    x: 24,
    y: 40,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdf.save();
}

export class MockUpsProvider implements ShippingProvider {
  readonly name = "ups" as const;

  async createLabel(request: LabelRequest): Promise<LabelResult> {
    const trackingNumber = mockTrackingNumber();
    const labelPdf = await renderMockLabelPdf(request, trackingNumber);
    return { ok: true, trackingNumber, labelPdf };
  }
}
