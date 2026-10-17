import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INVOICE_DUE_DAYS, isInvoiceOverdue, qrReferenceForOrder } from "@/lib/invoices";
import { IllegalTransitionError } from "@/lib/orders/state-machine";
import { MailMessageModel } from "@/models/mail-message";
import { OrderModel, type Order } from "@/models/order";
import { ProductModel } from "@/models/product";
import { UserModel } from "@/models/user";
import { createOrderCore } from "@/server/checkout";
import { hashPassword } from "@/server/password";
import {
  getInvoiceCreditUsageCents,
  getInvoiceFileCore,
  listInvoices,
  listInvoicesForUser,
  recordInvoicePaymentCore,
  sendInvoiceReminderCore,
  setCreditLimitCore,
} from "@/server/invoices";
import { transitionOrderCore } from "@/server/orders-admin";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CUSTOMER = {
  name: "Reto Invoice",
  email: "reto@example.ch",
  phone: "079 111 22 33",
  street: "Seestrasse 5",
  postalCode: "8038",
  city: "Küsnacht",
  country: "CH",
};

async function seedProduct(stock: number, tag: string, priceCents = 10_000) {
  await ProductModel.create({
    slug: `invoice-test-${tag}`,
    name: `Invoice Test ${tag}`,
    description: "Produkt für Rechnungs-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/invoice-test-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku: `IV-${tag}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

async function makeCustomer(email = CUSTOMER.email, creditLimitCents?: number) {
  return UserModel.create({
    email,
    name: CUSTOMER.name,
    passwordHash: await hashPassword("EinStarkesPasswort1"),
    role: "customer",
    addresses: [],
    ...(creditLimitCents !== undefined && { creditLimitCents }),
  });
}

function invoiceCheckout(sku: string, qty: number, expectedUnitPriceCents: number) {
  return createOrderCore(
    {
      lines: [{ sku, qty, expectedUnitPriceCents }],
      customer: CUSTOMER,
      shippingMethod: "standard",
      paymentMethod: "invoice",
    },
    { userId: undefined },
  );
}

async function order(number: string) {
  return OrderModel.findOne({ orderNumber: number }).lean<Order>().exec();
}

describe("invoice checkout (issue #40)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("guest invoice checkout is refused; the order stays a card order otherwise", async () => {
    await seedProduct(10, "guest");
    const result = await invoiceCheckout("IV-guest", 1, 10_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/registrierte Kunden/);
    expect(await OrderModel.countDocuments()).toBe(0);
  });

  it("creates an unpaid invoice order with due date and QR reference", async () => {
    const user = await makeCustomer();
    await seedProduct(10, "create");
    const result = await createOrderCore(
      {
        lines: [{ sku: "IV-create", qty: 2, expectedUnitPriceCents: 10_000 }],
        customer: CUSTOMER,
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const created = await order(result.orderNumber);
    expect(created?.status).toBe("new");
    expect(created?.statusLog.map((e) => e.status)).toEqual(["new"]);
    expect(created?.payment.method).toBe("invoice");
    expect(created?.payment.paidAt).toBeUndefined();
    const invoice = created?.payment.invoice;
    expect(invoice?.paidCents).toBe(0);
    expect(invoice?.qrReference).toBe(
      qrReferenceForOrder(Number(result.orderNumber.slice(2, 6)), Number(result.orderNumber.slice(7))),
    );
    // createdAt is stamped at insert, a few ms after the due-date anchor.
    const dueSpan = invoice!.dueAt.getTime() - created!.createdAt.getTime();
    expect(dueSpan).toBeLessThanOrEqual(INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);
    expect(dueSpan).toBeGreaterThan(INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000 - 5_000);
    // Stock moved even though no money did — the order is processable.
    const product = await ProductModel.findOne({ "variants.sku": "IV-create" }).lean().exec();
    expect(product?.variants[0]?.stock).toBe(8);
  });

  it("invoice orders can be processed unpaid but never paid via the status buttons", async () => {
    const all = await OrderModel.find().lean<Order[]>().exec();
    const invoiceOrder = all.find((o) => o.payment.method === "invoice");
    expect(invoiceOrder).toBeDefined();
    const id = invoiceOrder!._id.toString();

    // new → paid is the invoice payment's job, not the status button's.
    await expect(transitionOrderCore(id, "paid")).rejects.toThrow(IllegalTransitionError);

    const toPicking = await transitionOrderCore(id, "picking");
    expect(toPicking.ok).toBe(true);
    expect((await order(invoiceOrder!.orderNumber))?.status).toBe("picking");
  });

  it("enforces the credit limit across orders and reacts to payments", async () => {
    const user = await makeCustomer("limit@example.ch", 25_000);
    await seedProduct(50, "limit", 10_000);
    const asUser = (qty: number) =>
      createOrderCore(
        {
          lines: [{ sku: "IV-limit", qty, expectedUnitPriceCents: 10_000 }],
          customer: { ...CUSTOMER, email: "limit@example.ch" },
          shippingMethod: "standard",
          paymentMethod: "invoice",
        },
        { userId: user._id.toString() },
      );

    // 2 × 100.00 + 4.90 shipping = 20'490 of 25'000 — fits; one more does not.
    const first = await asUser(2);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(await getInvoiceCreditUsageCents(user._id.toString())).toBe(first.totals.totalCents);

    const second = await asUser(1);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/Kreditlimit/);

    // Paying the first invoice frees the credit again.
    const created = await order(first.orderNumber);
    const paid = await recordInvoicePaymentCore(
      created!._id.toString(),
      first.totals.totalCents,
      "admin@codershop.ch",
    );
    expect(paid.ok).toBe(true);
    expect(await getInvoiceCreditUsageCents(user._id.toString())).toBe(0);
    const third = await asUser(1);
    expect(third.ok).toBe(true);
  });

  it("records partial payments and settles with the full amount", async () => {
    const user = await makeCustomer("partial@example.ch");
    await seedProduct(10, "partial", 20_000);
    const result = await createOrderCore(
      {
        lines: [{ sku: "IV-partial", qty: 1, expectedUnitPriceCents: 20_000 }],
        customer: { ...CUSTOMER, email: "partial@example.ch" },
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await order(result.orderNumber);
    const id = created!._id.toString();
    const total = result.totals.totalCents;

    expect((await recordInvoicePaymentCore(id, total + 1, "admin")).ok).toBe(false);
    expect((await recordInvoicePaymentCore(id, 0, "admin")).ok).toBe(false);

    expect((await recordInvoicePaymentCore(id, 5_000, "admin")).ok).toBe(true);
    let fresh = await order(result.orderNumber);
    expect(fresh?.payment.invoice?.paidCents).toBe(5_000);
    expect(fresh?.status).toBe("new");
    expect(fresh?.payment.paidAt).toBeUndefined();

    expect((await recordInvoicePaymentCore(id, total - 5_000, "admin@x.ch")).ok).toBe(true);
    fresh = await order(result.orderNumber);
    expect(fresh?.payment.invoice?.paidCents).toBe(total);
    expect(fresh?.payment.paidAt).toBeInstanceOf(Date);
    expect(fresh?.status).toBe("paid");
    expect(fresh?.statusLog.map((e) => e.status)).toEqual(["new", "paid"]);
  });

  it("lists invoices for admin and portal with the overdue flag", async () => {
    const user = await makeCustomer("list@example.ch");
    await seedProduct(10, "list", 5_000);
    const result = await createOrderCore(
      {
        lines: [{ sku: "IV-list", qty: 1, expectedUnitPriceCents: 5_000 }],
        customer: { ...CUSTOMER, email: "list@example.ch" },
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Backdate the due date past today → overdue.
    await OrderModel.updateOne(
      { orderNumber: result.orderNumber },
      { $set: { "payment.invoice.dueAt": new Date(Date.now() - 86_400_000) } },
    );

    const open = await listInvoices("open");
    expect(open.map((i) => i.orderNumber)).toContain(result.orderNumber);
    const overdue = await listInvoices("overdue");
    expect(overdue.map((i) => i.orderNumber)).toContain(result.orderNumber);
    expect((await listInvoices("paid")).map((i) => i.orderNumber)).not.toContain(
      result.orderNumber,
    );

    const portal = await listInvoicesForUser(user._id.toString());
    const entry = portal.find((i) => i.orderNumber === result.orderNumber);
    expect(entry?.overdue).toBe(true);
    expect(entry?.openCents).toBe(result.totals.totalCents);
  });

  it("reminders: only overdue, level 2 after level 1, once each, with outbox mail", async () => {
    const all = await OrderModel.find({ "payment.method": "invoice" }).lean<Order[]>().exec();
    const overdueOrder = all.find((o) => o.payment.invoice && o.payment.invoice.dueAt < new Date());
    expect(overdueOrder).toBeDefined();
    const id = overdueOrder!._id.toString();

    const notOverdue = all.find(
      (o) => o.payment.invoice && o.payment.invoice.dueAt >= new Date(),
    );
    if (notOverdue) {
      expect((await sendInvoiceReminderCore(notOverdue._id.toString(), 1)).ok).toBe(false);
    }

    expect((await sendInvoiceReminderCore(id, 2)).ok).toBe(false); // 1st missing
    expect((await sendInvoiceReminderCore(id, 1)).ok).toBe(true);
    expect((await sendInvoiceReminderCore(id, 1)).ok).toBe(false); // once only
    expect((await sendInvoiceReminderCore(id, 2)).ok).toBe(true);
    expect((await sendInvoiceReminderCore(id, 2)).ok).toBe(false);

    const fresh = await OrderModel.findById(id).lean<Order>().exec();
    expect(fresh?.payment.invoice?.reminder1At).toBeInstanceOf(Date);
    expect(fresh?.payment.invoice?.reminder2At).toBeInstanceOf(Date);

    const mails = await MailMessageModel.find({ subject: "2. Mahnung" }).lean().exec();
    expect(mails.length).toBe(1);
    expect(mails[0].text).toContain(overdueOrder!.orderNumber);
  });

  it("generates the invoice PDF with the QR reference", async () => {
    const all = await OrderModel.find({ "payment.method": "invoice" }).lean<Order[]>().exec();
    const target = all[0];
    const file = await getInvoiceFileCore(target.orderNumber);
    expect(file).not.toBeNull();
    expect(file!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(file!.fileName).toBe(`${target.orderNumber}.pdf`);
    // Second call serves the stored file.
    expect(await getInvoiceFileCore(target.orderNumber)).not.toBeNull();
  });

  it("credit limit can be set by the admin and blocks invoice payment at 0", async () => {
    const user = await makeCustomer("zero@example.ch");
    expect((await setCreditLimitCore(user._id.toString(), 0)).ok).toBe(true);
    await seedProduct(10, "zero", 3_000);
    const result = await createOrderCore(
      {
        lines: [{ sku: "IV-zero", qty: 1, expectedUnitPriceCents: 3_000 }],
        customer: { ...CUSTOMER, email: "zero@example.ch" },
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Kreditlimit/);
  });

  it("isInvoiceOverdue stays false for a paid invoice regardless of the due date", () => {
    expect(
      isInvoiceOverdue({
        dueAt: new Date(0),
        totalCents: 100,
        paidCents: 100,
        now: new Date(),
      }),
    ).toBe(false);
  });
});
