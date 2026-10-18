// E-mail templates (issue #39/#44) — rendered from the translation table in the
// recipient's language (#58 decision point 3): every function takes the language's
// label map and formatters, so they stay pure and tests can assert the content. The
// HTML structure (paragraphs, emphasis, the code block) lives here, every text is a
// `mail.*` row with `{param}` holes; the shop's look is inlined because e-mail
// clients strip stylesheets.
import { interpolate, label } from "@/lib/i18n";
import type { Formatters } from "@/lib/format";

// The language a mail renders in: the stored language of its order/alert/account,
// resolved to texts and formats by the server (server/mail-context.ts).
export interface MailContext {
  language: string;
  labels: Readonly<Record<string, string>>;
  formatters: Formatters;
}

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

function t(ctx: MailContext, key: string): string {
  return label(ctx.labels, key);
}

function greeting(ctx: MailContext, name: string): string {
  return interpolate(t(ctx, "mail.greeting"), { name });
}

function layout(
  ctx: MailContext,
  title: string,
  bodyHtml: string,
  bodyText: string,
  cta?: { label: string; url: string },
): MailContent {
  const copyLink = cta
    ? `<p style="margin:8px 0 0;font-size:12px;color:#71717a">${interpolate(t(ctx, "mail.layout.copyLink"), { url: cta.url })}</p>`
    : "";
  const html = `<!doctype html><html lang="${ctx.language}"><body style="margin:0;background:#f4f4f5;padding:24px;font-family:ui-sans-serif,system-ui,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="margin:0 0 16px;font-weight:700;font-size:18px">coder-shop</p>
<h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
${bodyHtml}
${cta ? `<p style="margin:24px 0 8px"><a href="${cta.url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">${cta.label}</a></p>
${copyLink}` : ""}
<hr style="margin:24px 0;border:none;border-top:1px solid #e4e4e7">
<p style="margin:0;font-size:12px;color:#71717a">${t(ctx, "mail.layout.footer")}</p>
</div></body></html>`;
  const text = [`coder-shop`, "", title, "", bodyText, cta ? `${cta.label}: ${cta.url}` : ""]
    .filter(Boolean)
    .join("\n");
  return { subject: title, html, text };
}

export function welcomeMail(ctx: MailContext, name: string): MailContent {
  const body = t(ctx, "mail.welcome.body");
  const account = t(ctx, "mail.welcome.account");
  return layout(
    ctx,
    t(ctx, "mail.welcome.subject"),
    `<p>${greeting(ctx, name)}</p><p>${interpolate(body, { account: `<em>${account}</em>` })}</p>`,
    `${greeting(ctx, name)}\n\n${interpolate(body, { account: `"${account}"` })}`,
  );
}

// Reminder levels of an overdue invoice (issue #40) — the 2. Mahnung sentence is a
// row of its own, appended to the body only on level 2.
export function invoiceReminderMail(
  ctx: MailContext,
  name: string,
  orderNumber: string,
  openCents: number,
  level: 1 | 2,
): MailContent {
  const amount = ctx.formatters.chf(openCents);
  const body = t(ctx, "mail.reminder.body");
  const second = level === 2 ? ` ${t(ctx, "mail.reminder.second")}` : "";
  return layout(
    ctx,
    interpolate(t(ctx, "mail.reminder.subject"), { level }),
    `<p>${greeting(ctx, name)}</p><p>${interpolate(body, { orderNumber: `<strong>${orderNumber}</strong>`, amount: `<strong>${amount}</strong>` })}${second}</p>`,
    `${greeting(ctx, name)}\n\n${interpolate(body, { orderNumber, amount })}${second}`,
  );
}

// Order confirmation (issue #44) — sent right after checkout; the link leads to the
// confirmation page, which shows the full details behind the access rule (#3).
export function orderConfirmationMail(
  ctx: MailContext,
  input: { name: string; orderNumber: string; totalCents: number; link: string },
): MailContent {
  const amount = ctx.formatters.chf(input.totalCents);
  const body = t(ctx, "mail.confirm.body");
  return layout(
    ctx,
    t(ctx, "mail.confirm.subject"),
    `<p>${greeting(ctx, input.name)}</p><p>${interpolate(body, { orderNumber: `<strong>${input.orderNumber}</strong>`, amount: `<strong>${amount}</strong>` })}</p>`,
    `${greeting(ctx, input.name)}\n\n${interpolate(body, { orderNumber: input.orderNumber, amount })}`,
    { label: t(ctx, "mail.confirm.cta"), url: input.link },
  );
}

// Invoice order (issue #40/#44) — the PDF is downloadable behind the order visibility
// rule; the due date follows the mail language's date format (#58, no locale literal).
export function invoiceMail(
  ctx: MailContext,
  input: {
    name: string;
    orderNumber: string;
    totalCents: number;
    dueDate: Date;
    pdfLink: string;
  },
): MailContent {
  const amount = ctx.formatters.chf(input.totalCents);
  const dueDate = ctx.formatters.date(input.dueDate);
  const body = t(ctx, "mail.invoice.body");
  return layout(
    ctx,
    t(ctx, "mail.invoice.subject"),
    `<p>${greeting(ctx, input.name)}</p><p>${interpolate(body, { orderNumber: `<strong>${input.orderNumber}</strong>`, amount: `<strong>${amount}</strong>`, dueDate: `<strong>${dueDate}</strong>` })}</p>`,
    `${greeting(ctx, input.name)}\n\n${interpolate(body, { orderNumber: input.orderNumber, amount, dueDate })}`,
    { label: t(ctx, "mail.invoice.cta"), url: input.pdfLink },
  );
}

// Shipment (issue #44) — tracking number as soon as the label exists (#16); the
// carrier travels as data (the stored carrier code), never a literal.
export function shippedMail(
  ctx: MailContext,
  input: {
    name: string;
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    link: string;
  },
): MailContent {
  const body = t(ctx, "mail.shipped.body");
  return layout(
    ctx,
    t(ctx, "mail.shipped.subject"),
    `<p>${greeting(ctx, input.name)}</p><p>${interpolate(body, { orderNumber: `<strong>${input.orderNumber}</strong>`, carrier: input.carrier, tracking: `<strong>${input.trackingNumber}</strong>` })}</p>`,
    `${greeting(ctx, input.name)}\n\n${interpolate(body, { orderNumber: input.orderNumber, carrier: input.carrier, tracking: input.trackingNumber })}`,
    { label: t(ctx, "mail.shipped.cta"), url: input.link },
  );
}

// Pickup ready (issue #41/#44) — the code is the ticket at the counter; the store
// address and hours are store data, the sentences around them are rows.
export function pickupReadyMail(
  ctx: MailContext,
  input: {
    name: string;
    orderNumber: string;
    code: string;
    store: { name: string; street: string; postalCode: string; city: string; hours: readonly string[] };
  },
): MailContent {
  const address = `${input.store.name}, ${input.store.street}, ${input.store.postalCode} ${input.store.city}`;
  const body = t(ctx, "mail.pickup.body");
  const payment = t(ctx, "mail.pickup.payment");
  return layout(
    ctx,
    t(ctx, "mail.pickup.subject"),
    `<p>${greeting(ctx, input.name)}</p><p>${interpolate(body, { orderNumber: `<strong>${input.orderNumber}</strong>`, address: `<strong>${address}</strong>` })}</p><p style="margin:16px 0;font-size:28px;font-weight:700;letter-spacing:4px">${input.code}</p><p>${input.store.hours.join("<br>")}<br>${payment}</p>`,
    `${greeting(ctx, input.name)}\n\n${interpolate(body, { orderNumber: input.orderNumber, address })}\n\n${input.code}\n\n${input.store.hours.join("\n")}\n${payment}`,
  );
}

// Back in stock (issue #46) — sent to every address waiting on a sold-out variant.
export function restockAlertMail(
  ctx: MailContext,
  input: { productName: string; variantLabel: string; link: string },
): MailContent {
  const body = t(ctx, "mail.restock.body");
  const hello = t(ctx, "mail.greeting.formal");
  return layout(
    ctx,
    t(ctx, "mail.restock.subject"),
    `<p>${hello}</p><p>${interpolate(body, { product: `<strong>${input.productName}</strong>`, variant: `<strong>${input.variantLabel}</strong>` })}</p>`,
    `${hello}\n\n${interpolate(body, { product: input.productName, variant: input.variantLabel })}`,
    { label: t(ctx, "mail.restock.cta"), url: input.link },
  );
}

export function passwordResetMail(ctx: MailContext, name: string, link: string): MailContent {
  return layout(
    ctx,
    t(ctx, "mail.reset.subject"),
    `<p>${greeting(ctx, name)}</p><p>${t(ctx, "mail.reset.body")}</p>`,
    `${greeting(ctx, name)}\n\n${t(ctx, "mail.reset.body")}`,
    { label: t(ctx, "mail.reset.subject"), url: link },
  );
}
