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

export function passwordResetMail(name: string, link: string): MailContent {
  return layout(
    "Passwort zurücksetzen",
    `<p>Hallo ${name},</p><p>Sie haben ein neues Passwort angefordert. Der Link ist eine Stunde gültig und lässt sich nur einmal verwenden. Falls Sie das nicht waren, ignorieren Sie diese E-Mail einfach.</p>`,
    `Hallo ${name},\n\nSie haben ein neues Passwort angefordert. Der Link ist eine Stunde gültig und nur einmal verwendbar. Falls Sie das nicht waren, ignorieren Sie diese E-Mail.`,
    { label: "Passwort zurücksetzen", url: link },
  );
}
