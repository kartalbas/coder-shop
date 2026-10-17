// German e-mail templates (issue #39/#44) — pure functions so tests can assert the
// content; the shop's look is inlined because e-mail clients strip stylesheets.
import { formatChf } from "@/lib/format";

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

function layout(title: string, bodyHtml: string, bodyText: string, cta?: { label: string; url: string }): MailContent {
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f4f4f5;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="margin:0 0 16px;font-weight:700;font-size:18px">coder-shop</p>
<h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
${bodyHtml}
${cta ? `<p style="margin:24px 0 8px"><a href="${cta.url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">${cta.label}</a></p>
<p style="margin:8px 0 0;font-size:12px;color:#71717a">Oder kopieren Sie diesen Link: ${cta.url}</p>` : ""}
<hr style="margin:24px 0;border:none;border-top:1px solid #e4e4e7">
<p style="margin:0;font-size:12px;color:#71717a">coder-shop · Demo-Shop · Preise in CHF inkl. MwSt.</p>
</div></body></html>`;
  const text = [`coder-shop`, "", title, "", bodyText, cta ? `${cta.label}: ${cta.url}` : ""]
    .filter(Boolean)
    .join("\n");
  return { subject: title, html, text };
}

export function welcomeMail(name: string): MailContent {
  return layout(
    "Willkommen bei coder-shop",
    `<p>Hallo ${name},</p><p>Ihr Konto ist eingerichtet. Unter <em>Mein Konto</em> finden Sie Ihre Bestellungen, Rechnungen und Adressen.</p>`,
    `Hallo ${name},\n\nIhr Konto ist eingerichtet. Unter "Mein Konto" finden Sie Ihre Bestellungen, Rechnungen und Adressen.`,
  );
}

// Reminder levels of an overdue invoice (issue #40) — German UI copy.
export function invoiceReminderMail(
  name: string,
  orderNumber: string,
  openCents: number,
  level: 1 | 2,
): MailContent {
  const amount = formatChf(openCents);
  const title = level === 1 ? "1. Mahnung" : "2. Mahnung";
  return layout(
    title,
    `<p>Hallo ${name},</p><p>die Rechnung zur Bestellung <strong>${orderNumber}</strong> ist überfällig. Bitte begleichen Sie den offenen Betrag von <strong>${amount}</strong> in den nächsten Tagen${level === 2 ? " — es ist bereits die zweite Mahnung" : ""}. Bei bereits beglichener Rechnung ignorieren Sie diese E-Mail einfach.</p>`,
    `Hallo ${name},\n\ndie Rechnung zur Bestellung ${orderNumber} ist überfällig. Bitte begleichen Sie den offenen Betrag von ${amount} in den nächsten Tagen${level === 2 ? " (2. Mahnung)" : ""}. Bei bereits beglichener Rechnung ignorieren Sie diese E-Mail.`,
  );
}

// Order confirmation (issue #44) — sent right after checkout; the link leads to the
// confirmation page, which shows the full details behind the access rule (#3).
export function orderConfirmationMail(input: {
  name: string;
  orderNumber: string;
  totalCents: number;
  link: string;
}): MailContent {
  const amount = formatChf(input.totalCents);
  return layout(
    "Vielen Dank für Ihre Bestellung",
    `<p>Hallo ${input.name},</p><p>Ihre Bestellung <strong>${input.orderNumber}</strong> ist bei uns eingegangen. Der Betrag von <strong>${amount}</strong> wurde${""} vorbereitet; sobald das Paket unterwegs ist, senden wir Ihnen die Sendungsnummer.</p>`,
    `Hallo ${input.name},\n\nIhre Bestellung ${input.orderNumber} ist bei uns eingegangen. Der Betrag von ${amount} wurde vorbereitet; sobald das Paket unterwegs ist, senden wir Ihnen die Sendungsnummer.`,
    { label: "Bestellung ansehen", url: input.link },
  );
}

// Invoice order (issue #40/#44) — the PDF is downloadable behind the order visibility rule.
export function invoiceMail(input: {
  name: string;
  orderNumber: string;
  totalCents: number;
  dueDate: string;
  pdfLink: string;
}): MailContent {
  const amount = formatChf(input.totalCents);
  return layout(
    "Ihre Rechnung",
    `<p>Hallo ${input.name},</p><p>vielen Dank für Bestellung <strong>${input.orderNumber}</strong>. Anbei finden Sie die Rechnung über <strong>${amount}</strong>, zahlbar bis <strong>${input.dueDate}</strong>. Der Einzahlungsschein ist QR-rechtskonform.</p>`,
    `Hallo ${input.name},\n\nvielen Dank für Bestellung ${input.orderNumber}. Die Rechnung über ${amount} ist zahlbar bis ${input.dueDate}. Der Einzahlungsschein ist QR-rechtskonform.`,
    { label: "Rechnung als PDF", url: input.pdfLink },
  );
}

// Shipment (issue #44) — tracking number as soon as the label exists (#16).
export function shippedMail(input: {
  name: string;
  orderNumber: string;
  trackingNumber: string;
  link: string;
}): MailContent {
  return layout(
    "Ihre Sendung ist unterwegs",
    `<p>Hallo ${input.name},</p><p>Bestellung <strong>${input.orderNumber}</strong> haben wir an UPS übergeben. Sendungsnummer: <strong>${input.trackingNumber}</strong>. Damit können Sie den Lauf der Sendung verfolgen.</p>`,
    `Hallo ${input.name},\n\nBestellung ${input.orderNumber} haben wir an UPS übergeben. Sendungsnummer: ${input.trackingNumber}.`,
    { label: "Bestellung verfolgen", url: input.link },
  );
}

// Pickup ready (issue #41/#44) — the code is the ticket at the counter.
export function pickupReadyMail(input: {
  name: string;
  orderNumber: string;
  code: string;
  store: { name: string; street: string; postalCode: string; city: string; hours: readonly string[] };
}): MailContent {
  const address = `${input.store.name}, ${input.store.street}, ${input.store.postalCode} ${input.store.city}`;
  return layout(
    "Ihre Bestellung liegt bereit",
    `<p>Hallo ${input.name},</p><p>Bestellung <strong>${input.orderNumber}</strong> liegt ab sofort zur Abholung bereit: <strong>${address}</strong>. Zeigen Sie an der Kasse diesen Abholcode:</p><p style="margin:16px 0;font-size:28px;font-weight:700;letter-spacing:4px">${input.code}</p><p>${input.store.hours.join("<br>")}<br>Bezahlung bar oder mit Karte bei der Übergabe.</p>`,
    `Hallo ${input.name},\n\nBestellung ${input.orderNumber} liegt zur Abholung bereit: ${address}.\n\nAbholcode: ${input.code}\n\n${input.store.hours.join("\n")}\nBezahlung bar oder mit Karte bei der Übergabe.`,
  );
}

export function passwordResetMail(name: string, link: string): MailContent {
  return layout(
    "Passwort zurücksetzen",
    `<p>Hallo ${name},</p><p>Sie haben ein neues Passwort angefordert. Der Link ist eine Stunde gültig und lässt sich nur einmal verwenden. Falls Sie das nicht waren, ignorieren Sie diese E-Mail einfach.</p>`,
    `Hallo ${name},\n\nSie haben ein neues Passwort angefordert. Der Link ist eine Stunde gültig und nur einmal verwendbar. Falls Sie das nicht waren, ignorieren Sie diese E-Mail.`,
    { label: "Passwort zurücksetzen", url: link },
  );
}
