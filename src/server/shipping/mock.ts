import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { interpolate, label } from "@/lib/i18n";
import { labelSerialLines } from "@/lib/shipping/label-content";
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
  // #58 decision point 3: every printed text is a `shop.label.*` row from the label
  // map the server resolved in the order's language; carrier names ride as data.
  const t = (key: string) => label(request.labels, key);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 600]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("UPS", { x: 24, y: 566, size: 28, font: bold, color: rgb(0.35, 0.2, 0.05) });
  page.drawText(t("shop.label.title"), { x: 24, y: 544, size: 10, font });
  page.drawRectangle({ x: 24, y: 520, width: 352, height: 2, color: rgb(0.2, 0.2, 0.2) });

  page.drawText(t("shop.label.recipient"), { x: 24, y: 496, size: 9, font: bold });
  const recipientLines = [
    request.recipient.name,
    request.recipient.street,
    `${request.recipient.postalCode} ${request.recipient.city}`,
    request.recipient.country,
  ];
  recipientLines.forEach((line, index) => {
    page.drawText(line, { x: 24, y: 480 - index * 14, size: 11, font });
  });

  page.drawText(interpolate(t("shop.label.order"), { number: request.orderNumber }), {
    x: 24,
    y: 410,
    size: 10,
    font,
  });
  page.drawText(
    interpolate(t("shop.label.shipping"), {
      service: request.service === "express" ? "UPS Express" : "UPS Standard",
    }),
    { x: 24, y: 396, size: 10, font },
  );
  page.drawText(
    interpolate(t("shop.label.weight"), {
      weight: `${(request.parcelWeightGrams / 1000).toFixed(2)} kg`,
    }),
    { x: 24, y: 382, size: 10, font },
  );

  // Issue #62 (#54): the parcel's serial numbers, same copy as the packing slip.
  const serialLines = labelSerialLines(request.serials ?? [], t("shop.label.serials"));
  const LABEL_SERIAL_LINES = 2;
  serialLines.slice(0, LABEL_SERIAL_LINES).forEach((line, index) => {
    page.drawText(line, { x: 24, y: 366 - index * 11, size: 8, font });
  });
  if (serialLines.length > LABEL_SERIAL_LINES) {
    page.drawText(
      interpolate(t("shop.label.moreSerials"), { count: serialLines.length - LABEL_SERIAL_LINES }),
      { x: 24, y: 366 - LABEL_SERIAL_LINES * 11, size: 8, font, color: rgb(0.4, 0.4, 0.4) },
    );
  }

  page.drawText("Tracking", { x: 24, y: 340, size: 9, font: bold });
  page.drawText(trackingNumber, { x: 24, y: 318, size: 20, font: bold });
  page.drawText("1Z" + trackingNumber.slice(2, 10) + " " + trackingNumber.slice(10), {
    x: 24,
    y: 296,
    size: 12,
    font,
  });

  page.drawText(t("shop.label.demoDisclaimer"), {
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
