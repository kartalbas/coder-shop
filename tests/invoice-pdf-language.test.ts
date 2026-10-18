import { describe, expect, it } from "vitest";
import { createFormatters } from "@/lib/format";
import { labelMap } from "@/lib/i18n";
import type { MailContext } from "@/lib/mail-templates";
import type { Order } from "@/models/order";
import { buildInvoicePdf } from "@/server/invoices-pdf";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { pdfDrawnText } from "@/test/pdf-text";

// Issue #58 decision point 3 / step 6: the invoice PDF is a customer document — every
// drawn text is a translation row and every amount/date follows the Intl set of the
// order's stored language. The German base is asserted byte-identically so the
// existing German invoice flows stay the regression check.

function fixtureOrder(language: string): Order {
  const createdAt = new Date(Date.UTC(2026, 6, 1, 12, 0, 0));
  return {
    orderNumber: "B-2026-999001",
    language,
    createdAt,
    customer: {
      name: "Lang Person",
      email: "langue@example.ch",
      street: "Chemin d'Essai 5",
      postalCode: "1003",
      city: "Lausanne",
    },
    lines: [
      {
        qty: 2,
        name: "Sprach Test",
        variantLabel: "128 GB / noir",
        totalCents: 20_000,
        serials: ["IMEI-PDF-0001", "IMEI-PDF-0002"],
      },
    ],
    totals: { subtotalCents: 20_000, shippingCents: 0, totalCents: 20_000, vatCents: 1_495 },
    discount: { code: "RABATT10", cents: 1_000 },
    payment: {
      kind: "invoice",
      invoice: {
        dueAt: new Date(Date.UTC(2026, 6, 31, 12, 0, 0)),
        paidCents: 5_000,
        qrReference: "RF1234567890123456789012345603",
      },
    },
  } as unknown as Order;
}

function contextFor(language: string, intlLocale: string): MailContext {
  return {
    language,
    labels: labelMap(DEFAULT_TRANSLATIONS, language),
    formatters: createFormatters(intlLocale),
  };
}

describe("invoice PDF renders in the order's language (#58 step 6)", () => {
  it("keeps the German document byte-identical to the retired literals", async () => {
    const pdf = await buildInvoicePdf(fixtureOrder("de"), 8.1, contextFor("de", "de-CH"));
    const text = pdfDrawnText(pdf);
    expect(text).toContain("Rechnung");
    expect(text).toContain("Bestellung B-2026-999001");
    expect(text).toContain("Rechnungsempfänger");
    expect(text).toContain("Positionen");
    expect(text).toContain("2× Sprach Test (128 GB / noir)");
    expect(text).toContain("Serien: IMEI-PDF-0001, IMEI-PDF-0002");
    expect(text).toContain("Zwischensumme");
    expect(text).toContain("Rabatt (RABATT10)");
    expect(text).toContain("Versand");
    expect(text).toContain("Gratis");
    expect(text).toContain("Total");
    expect(text).toContain("Erhalten");
    expect(text).toContain("Offen");
    expect(text).toContain("8,1 % MwSt. inbegriffen");
    expect(text).toContain("Empfangsschein");
    expect(text).toContain("Zahlteil");
    expect(text).toContain("Währung / Betrag");
    expect(text).toContain("Konto / Zahlbar an");
    expect(text).toContain("Referenz");
    expect(text).toContain("Zahlbar durch");
    expect(text).toContain(" coder-shop · Swiss QR-Rechnung (Demo)");
  });

  it("draws the French rows and no German for a French order", async () => {
    const pdf = await buildInvoicePdf(fixtureOrder("fr"), 8.1, contextFor("fr", "fr-CH"));
    const text = pdfDrawnText(pdf);
    expect(text).toContain("Facture");
    expect(text).toContain("Commande B-2026-999001");
    expect(text).toContain("Facturé à");
    expect(text).toContain("Positions");
    expect(text).toContain("Sous-total");
    expect(text).toContain("Livraison");
    expect(text).toContain("Gratuit");
    expect(text).toContain("Reçu");
    expect(text).toContain("Récépissé");
    expect(text).toContain("Référence");
    expect(text).not.toContain("Rechnungsempfänger");
    expect(text).not.toContain("Zwischensumme");
    expect(text).not.toContain("Empfangsschein");
    expect(text).not.toContain("Zahlbar durch");
  });

  it("formats the amounts and dates with the Intl set of the language", async () => {
    const pdf = await buildInvoicePdf(fixtureOrder("fr"), 8.1, contextFor("fr", "fr-CH"));
    const text = pdfDrawnText(pdf);
    // Intl-derived expectations — no pinned ICU vocabulary beyond the CHF suffix.
    const fr = createFormatters("fr-CH");
    expect(text).toContain(fr.chf(20_000));
    expect(text).toContain(fr.date(new Date(Date.UTC(2026, 6, 31, 12, 0, 0))));
    expect(text).toContain("CHF");
    const de = createFormatters("de-CH");
    const germanPdf = pdfDrawnText(
      await buildInvoicePdf(fixtureOrder("de"), 8.1, contextFor("de", "de-CH")),
    );
    expect(germanPdf).toContain(de.chf(20_000));
    expect(germanPdf).toContain(de.date(new Date(Date.UTC(2026, 6, 31, 12, 0, 0))));
  });
});
