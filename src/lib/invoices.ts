// Pure invoice rules (issue #40): due date, open amount, overdue flag, and the Swiss
// QR-bill reference/payload. No I/O — the server applies them to order documents.

export const INVOICE_DUE_DAYS = 30;

// Credit a registered customer may hold in open invoices unless the admin sets a
// personal limit (user.creditLimitCents).
export const DEFAULT_CREDIT_LIMIT_CENTS = 100_000;

// Demo creditor of the QR-bill (the shop itself — no real postal account).
export const QR_BILL_CREDITOR = {
  iban: "CH9300762011623852957",
  name: "coder-shop AG",
  street: "Bahnhofstrasse 1",
  postalCode: "8001",
  city: "Zürich",
  country: "CH",
} as const;

export function invoiceDueAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);
}

export function openAmountCents(totalCents: number, paidCents: number): number {
  return Math.max(0, totalCents - paidCents);
}

export function isInvoicePaid(totalCents: number, paidCents: number): boolean {
  return openAmountCents(totalCents, paidCents) === 0;
}

export function isInvoiceOverdue(input: {
  dueAt: Date;
  totalCents: number;
  paidCents: number;
  now: Date;
}): boolean {
  if (isInvoicePaid(input.totalCents, input.paidCents)) return false;
  return input.now.getTime() > input.dueAt.getTime();
}

// ISO 7064 mod 97-10 over a digit string — the check-digit method of the Swiss payment
// reference (and of IBANs). Processes the number in chunks so arbitrary length is safe.
export function mod97(digits: string): number {
  let remainder = 0;
  for (const char of digits) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return remainder;
}

// QRR reference for an order — an ISO 11649 creditor reference ("RF" + 2 ISO-7064
// check digits + content, here: demo creditor number + order year + sequence).
export function qrReferenceForOrder(year: number, seq: number): string {
  const content = `12345${year}${String(seq).padStart(12, "0")}`;
  return `RF${String(98 - mod97(`${content}271500`)).padStart(2, "0")}${content}`;
}

// ISO 11649 validation: move "RF" to the end as 2715 with the check digits last —
// the digit string is valid exactly when its mod 97 is 1.
export function isValidQrReference(reference: string): boolean {
  const match = /^RF(\d{2})([A-Z0-9]{1,21})$/.exec(reference);
  if (!match) return false;
  const [, check, content] = match;
  return mod97(`${content}2715${check}`) === 1;
}

export interface QrBillInput {
  amountCents: number;
  reference: string;
  debtorName?: string;
  additionalInformation?: string;
}

// The Swiss QR Code "Swiss QR Code Payment" payload (character set SPC, version 0200) —
// 31 CRLF-separated lines; empty lines are unused optional fields.
export function qrBillPayload(input: QrBillInput): string {
  const amount = input.amountCents > 0 ? (input.amountCents / 100).toFixed(2) : "";
  const lines = [
    "SPC",
    "0200",
    "1",
    QR_BILL_CREDITOR.iban,
    QR_BILL_CREDITOR.name,
    "S",
    QR_BILL_CREDITOR.street,
    QR_BILL_CREDITOR.postalCode,
    QR_BILL_CREDITOR.city,
    QR_BILL_CREDITOR.country,
    "",
    "",
    amount,
    "CHF",
    input.debtorName ?? "",
    "S",
    "",
    "",
    "",
    "",
    "QRR",
    input.reference,
    input.additionalInformation ?? "",
    "",
    "",
    "",
    "EPD",
    "",
    "S",
    "",
    "",
  ];
  return lines.join("\r\n");
}
