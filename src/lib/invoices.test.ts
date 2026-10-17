import { describe, expect, it } from "vitest";
import {
  INVOICE_DUE_DAYS,
  invoiceDueAt,
  isInvoiceOverdue,
  isInvoicePaid,
  isValidQrReference,
  mod97,
  openAmountCents,
  qrBillPayload,
  qrReferenceForOrder,
} from "./invoices";

describe("invoice due date and amounts", () => {
  it("is due 30 days after creation", () => {
    const created = new Date("2026-03-01T08:00:00Z");
    expect(invoiceDueAt(created).getTime() - created.getTime()).toBe(
      INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it("open amount never goes negative and partial payments reduce it", () => {
    expect(openAmountCents(10_000, 4_000)).toBe(6_000);
    expect(openAmountCents(10_000, 10_000)).toBe(0);
    expect(openAmountCents(10_000, 12_000)).toBe(0);
    expect(isInvoicePaid(10_000, 9_999)).toBe(false);
    expect(isInvoicePaid(10_000, 10_000)).toBe(true);
  });

  it("overdue only while open and only after the due date", () => {
    const dueAt = new Date("2026-04-01T00:00:00Z");
    const base = { dueAt, totalCents: 5_000, paidCents: 0 };
    expect(isInvoiceOverdue({ ...base, now: new Date("2026-03-31T23:59:00Z") })).toBe(false);
    expect(isInvoiceOverdue({ ...base, now: new Date("2026-04-02T00:00:00Z") })).toBe(true);
    expect(
      isInvoiceOverdue({ ...base, paidCents: 5_000, now: new Date("2026-04-02T00:00:00Z") }),
    ).toBe(false);
  });
});

describe("QR reference (Swiss QRR, ISO 11649)", () => {
  it("mod97 is the plain remainder over arbitrary length digit strings", () => {
    expect(mod97("0")).toBe(0);
    expect(mod97("100")).toBe(3);
    // 9853910415710094230522912271500 mod 97 = 17 (checked against exact integer math)
    expect(mod97("9853910415710094230522912271500")).toBe(17);
  });

  it("builds a valid ISO 11649 reference from the order", () => {
    const reference = qrReferenceForOrder(2026, 42);
    expect(reference).toMatch(/^RF\d{2}12345\d{16}$/);
    expect(isValidQrReference(reference)).toBe(true);
  });

  it("rejects tampered references", () => {
    const reference = qrReferenceForOrder(2026, 42);
    const last = reference.slice(-1);
    const tampered = `${reference.slice(0, -1)}${last === "1" ? "2" : "1"}`;
    expect(isValidQrReference(tampered)).toBe(false);
    expect(isValidQrReference("RF00")).toBe(false);
    expect(isValidQrReference("213910415710094230522912")).toBe(false);
  });

  it("is deterministic and differs per order", () => {
    expect(qrReferenceForOrder(2026, 42)).toBe(qrReferenceForOrder(2026, 42));
    expect(qrReferenceForOrder(2026, 42)).not.toBe(qrReferenceForOrder(2026, 43));
  });
});

describe("qrBillPayload", () => {
  it("is the 31-line SPC payload with amount, currency and reference", () => {
    const payload = qrBillPayload({
      amountCents: 12_345,
      reference: qrReferenceForOrder(2026, 7),
      debtorName: "Max Muster",
      additionalInformation: "Bestellung B-2026-000007",
    });
    const lines = payload.split("\r\n");
    expect(lines).toHaveLength(31);
    expect(lines[0]).toBe("SPC");
    expect(lines[1]).toBe("0200");
    expect(lines[12]).toBe("123.45");
    expect(lines[13]).toBe("CHF");
    expect(lines[14]).toBe("Max Muster");
    expect(lines[20]).toBe("QRR");
    expect(lines[21]).toBe(qrReferenceForOrder(2026, 7));
    expect(lines[22]).toBe("Bestellung B-2026-000007");
  });
});
