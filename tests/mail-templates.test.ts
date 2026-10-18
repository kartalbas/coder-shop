import { describe, expect, it } from "vitest";
import { createFormatters } from "@/lib/format";
import { BASE_LANGUAGE, DEFAULT_LANGUAGES, intlLocaleOf, labelMap } from "@/lib/i18n";
import {
  invoiceMail,
  invoiceReminderMail,
  orderConfirmationMail,
  passwordResetMail,
  pickupReadyMail,
  restockAlertMail,
  shippedMail,
  welcomeMail,
  type MailContext,
} from "@/lib/mail-templates";
import { STORE } from "@/lib/store";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";

// Issue #58 decision point 3: the templates render from the translation table in the
// recipient's language. The German context is the byte-identity check of the
// extraction (subjects and sentences are the old literals, now rows); the French
// context proves texts, amounts, dates and the <html lang> all follow the language —
// expected renderings are computed from Intl, no ICU vocabulary is pinned.

function ctxFor(code: string): MailContext {
  return {
    language: code,
    labels: labelMap(DEFAULT_TRANSLATIONS, code),
    formatters: createFormatters(intlLocaleOf(DEFAULT_LANGUAGES, code)),
  };
}

const de = ctxFor(BASE_LANGUAGE);
const fr = ctxFor("fr");
const frLabels = labelMap(DEFAULT_TRANSLATIONS, "fr");

function frChf(value: number): string {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value);
}

describe("mail templates render in the German base language (#58 byte-identity)", () => {
  it("keeps every subject and the layout chrome byte-identical to the old literals", () => {
    const confirmation = orderConfirmationMail(de, {
      name: "Lena",
      orderNumber: "B-2026-000001",
      totalCents: 10_000,
      link: "https://shop.example/de/orders/B-2026-000001",
    });
    expect(confirmation.subject).toBe("Vielen Dank für Ihre Bestellung");
    expect(confirmation.html).toContain("Oder kopieren Sie diesen Link:");
    expect(confirmation.html).toContain("Preise in CHF inkl. MwSt.");
    expect(confirmation.html).toContain("Bestellung ansehen");
    expect(confirmation.html).toContain('lang="de"');

    expect(invoiceMail(de, {
      name: "Lena",
      orderNumber: "B-2026-000002",
      totalCents: 10_000,
      dueDate: new Date(),
      pdfLink: "https://shop.example/invoice",
    }).subject).toBe("Ihre Rechnung");
    expect(shippedMail(de, {
      name: "Lena",
      orderNumber: "B-2026-000003",
      trackingNumber: "1ZDE",
      carrier: "UPS",
      link: "https://shop.example/de/orders/B-2026-000003",
    }).subject).toBe("Ihre Sendung ist unterwegs");
    expect(pickupReadyMail(de, {
      name: "Lena",
      orderNumber: "B-2026-000004",
      code: "ABC234",
      store: STORE,
    }).subject).toBe("Ihre Bestellung liegt bereit");
    expect(welcomeMail(de, "Lena").subject).toBe("Willkommen bei coder-shop");
    expect(welcomeMail(de, "Lena").html).toContain("<em>Mein Konto</em>");
    expect(passwordResetMail(de, "Lena", "https://shop.example/reset").subject).toBe(
      "Passwort zurücksetzen",
    );
    expect(restockAlertMail(de, {
      productName: "Produkt",
      variantLabel: "128 GB",
      link: "https://shop.example/de/products/p",
    }).text).toContain("Guten Tag,");
  });

  it("the reminder subject interpolates the level and level 2 adds its sentence", () => {
    expect(invoiceReminderMail(de, "Lena", "B-2026-000005", 10_000, 1).subject).toBe("1. Mahnung");
    const second = invoiceReminderMail(de, "Lena", "B-2026-000005", 10_000, 2);
    expect(second.subject).toBe("2. Mahnung");
    expect(second.text).toContain("Es ist bereits die zweite Mahnung.");
    expect(invoiceReminderMail(de, "Lena", "B-2026-000005", 10_000, 1).text).not.toContain(
      "zweite Mahnung",
    );
  });
});

describe("mail templates render in French (#58 recipient language)", () => {
  it("confirmation: French subject, body, CTA, chrome and fr-CH amount", () => {
    const mail = orderConfirmationMail(fr, {
      name: "Lena",
      orderNumber: "B-2026-000010",
      totalCents: 12_345,
      link: "https://shop.example/fr/orders/B-2026-000010",
    });
    expect(mail.subject).toBe(frLabels["mail.confirm.subject"]);
    expect(mail.subject).not.toBe("Vielen Dank für Ihre Bestellung");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain(frLabels["mail.confirm.body"].split("{")[0].trim());
      expect(body).toContain(frChf(123.45));
      expect(body).not.toContain("Vielen Dank");
    }
    expect(mail.html).toContain('lang="fr"');
    expect(mail.html).toContain(frLabels["mail.confirm.cta"]);
    expect(mail.html).toContain(frLabels["mail.layout.copyLink"].split("{")[0].trim());
    expect(mail.html).toContain(frLabels["mail.layout.footer"]);
  });

  it("invoice: French text with the fr-CH long due date", () => {
    const dueDate = new Date(Date.UTC(2026, 10, 16));
    const mail = invoiceMail(fr, {
      name: "Lena",
      orderNumber: "B-2026-000011",
      totalCents: 50_000,
      dueDate,
      pdfLink: "https://shop.example/fr/orders/B-2026-000011/invoice",
    });
    expect(mail.subject).toBe(frLabels["mail.invoice.subject"]);
    const due = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long" }).format(dueDate);
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain(due);
      expect(body).toContain(frChf(500));
    }
  });

  it("reminder, shipment, pickup, restock, welcome and reset all answer in French", () => {
    expect(invoiceReminderMail(fr, "Lena", "B-2026-000012", 10_000, 1).subject).toBe("1e relance");
    const shipped = shippedMail(fr, {
      name: "Lena",
      orderNumber: "B-2026-000013",
      trackingNumber: "1ZFR",
      carrier: "UPS",
      link: "https://shop.example/fr/orders/B-2026-000013",
    });
    expect(shipped.subject).toBe(frLabels["mail.shipped.subject"]);
    expect(shipped.text).toContain(frLabels["mail.shipped.body"].split("{")[0].trim());
    const pickup = pickupReadyMail(fr, {
      name: "Lena",
      orderNumber: "B-2026-000014",
      code: "ABC234",
      store: STORE,
    });
    expect(pickup.subject).toBe(frLabels["mail.pickup.subject"]);
    expect(pickup.text).toContain(frLabels["mail.pickup.payment"]);
    const restock = restockAlertMail(fr, {
      productName: "Produit",
      variantLabel: "128 GB",
      link: "https://shop.example/fr/products/p",
    });
    expect(restock.subject).toBe(frLabels["mail.restock.subject"]);
    expect(restock.text).toContain("Bonjour,");
    expect(welcomeMail(fr, "Lena").subject).toBe(frLabels["mail.welcome.subject"]);
    expect(welcomeMail(fr, "Lena").text).toContain(frLabels["mail.welcome.account"]);
    const reset = passwordResetMail(fr, "Lena", "https://shop.example/fr/reset");
    expect(reset.subject).toBe(frLabels["mail.reset.subject"]);
    expect(reset.html).toContain(frLabels["mail.reset.subject"]);
  });

  it("every mail language row is filled in all seeded languages", () => {
    const codes = DEFAULT_LANGUAGES.map((language) => language.code);
    for (const entry of DEFAULT_TRANSLATIONS.filter((row) => row.key.startsWith("mail."))) {
      expect(entry.de.trim()).not.toBe("");
      for (const code of codes.filter((c) => c !== BASE_LANGUAGE)) {
        expect(entry.texts[code]?.trim(), `${entry.key} in ${code}`).not.toBe("");
      }
    }
  });
});
