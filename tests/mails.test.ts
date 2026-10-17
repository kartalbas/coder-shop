import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HAPPY_PATH } from "@/lib/orders/state-machine";
import {
  invoiceMail,
  orderConfirmationMail,
  pickupReadyMail,
  shippedMail,
} from "@/lib/mail-templates";
import { STORE } from "@/lib/store";
import { formatChf } from "@/lib/format";
import { MailMessageModel } from "@/models/mail-message";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { UserModel } from "@/models/user";
import { createOrderCore } from "@/server/checkout";
import { hashPassword } from "@/server/password";
import { markPickupReadyCore } from "@/server/pickup";
import { createLabelCore } from "@/server/shipping/label";
import { selectTransportName } from "@/server/mail";
import { MockUpsProvider } from "@/server/shipping/mock";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const CUSTOMER = {
  name: "Mail Person",
  email: "empfaenger@example.ch",
  phone: "079 999 88 77",
  street: "Testweg 5",
  postalCode: "8001",
  city: "Zürich",
  country: "CH",
};

async function seedProduct(stock: number, tag: string, priceCents = 10_000) {
  await ProductModel.create({
    slug: `mail-test-${tag}`,
    name: `Mail Test ${tag}`,
    description: "Produkt für Mail-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/mail-test-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku: `ML-${tag}`,
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

async function outbox(to?: string) {
  // _id (ObjectId) is the insertion order — two mails written in the same millisecond
  // would sort nondeterministically by sentAt.
  const messages = await MailMessageModel.find(to ? { to } : {})
    .sort({ _id: 1 })
    .lean()
    .exec();
  return messages;
}

describe("mail templates (issue #44)", () => {
  it("confirmation names the order, the amount and links to the confirmation page", () => {
    const mail = orderConfirmationMail({
      name: "Lena",
      orderNumber: "B-2026-000123",
      totalCents: 12_345,
      link: "https://shop.example/bestellung/B-2026-000123",
    });
    expect(mail.subject).toBe("Vielen Dank für Ihre Bestellung");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("Lena");
      expect(body).toContain("B-2026-000123");
      expect(body).toContain(formatChf(12_345));
    }
    expect(mail.html).toContain("https://shop.example/bestellung/B-2026-000123");
  });

  it("invoice carries the amount, the due date and the PDF link", () => {
    const mail = invoiceMail({
      name: "Lena",
      orderNumber: "B-2026-000124",
      totalCents: 50_000,
      dueDate: "16.11.2026",
      pdfLink: "https://shop.example/bestellung/B-2026-000124/rechnung",
    });
    expect(mail.subject).toBe("Ihre Rechnung");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("B-2026-000124");
      expect(body).toContain(formatChf(50_000));
      expect(body).toContain("16.11.2026");
    }
    expect(mail.html).toContain("/rechnung");
  });

  it("shipment mail contains the tracking number", () => {
    const mail = shippedMail({
      name: "Lena",
      orderNumber: "B-2026-000125",
      trackingNumber: "1ZTESTTRACKING01",
      link: "https://shop.example/bestellung/B-2026-000125",
    });
    expect(mail.subject).toBe("Ihre Sendung ist unterwegs");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("1ZTESTTRACKING01");
      expect(body).toContain("B-2026-000125");
    }
  });

  it("pickup mail contains the code, the store address and the hours", () => {
    const mail = pickupReadyMail({
      name: "Lena",
      orderNumber: "B-2026-000126",
      code: "K7M2XQ",
      store: STORE,
    });
    expect(mail.subject).toBe("Ihre Bestellung liegt bereit");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("K7M2XQ");
      expect(body).toContain("B-2026-000126");
      expect(body).toContain("Bahnhofstrasse 1");
      expect(body).toContain("Mo–Fr 09:00–18:30");
    }
  });

  it("transport selection: SMTP only when configured, otherwise the outbox", () => {
    expect(selectTransportName(false)).toBe("outbox");
    expect(selectTransportName(true)).toBe("smtp");
  });
});

describe("workflow mails land in the dev outbox (issue #44)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(disconnectTestDB);

  it("checkout sends the confirmation; invoice checkout also the invoice", async () => {
    await seedProduct(5, "confirm");
    const result = await createOrderCore({
      lines: [{ sku: "ML-confirm", qty: 2, expectedUnitPriceCents: 10_000 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const mails = await outbox(CUSTOMER.email);
    expect(mails).toHaveLength(1); // card payment: no invoice mail
    expect(mails[0]?.subject).toBe("Vielen Dank für Ihre Bestellung");
    expect(mails[0]?.html).toContain(result.orderNumber);
    expect(mails[0]?.html).toContain("/bestellung/" + result.orderNumber);

    // Rechnung order of a registered customer → confirmation + invoice with PDF link.
    const user = await UserModel.create({
      email: "rechnung@example.ch",
      name: "Rechnung Person",
      passwordHash: await hashPassword("EinStarkesPasswort1"),
      role: "customer",
      addresses: [],
    });
    await seedProduct(5, "invoice");
    const invoice = await createOrderCore(
      {
        lines: [{ sku: "ML-invoice", qty: 1, expectedUnitPriceCents: 10_000 }],
        customer: { ...CUSTOMER, email: "rechnung@example.ch" },
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(invoice.ok).toBe(true);
    const invoiceMails = await outbox("rechnung@example.ch");
    expect(invoiceMails.map((m) => m.subject)).toEqual([
      "Vielen Dank für Ihre Bestellung",
      "Ihre Rechnung",
    ]);
    expect(invoiceMails[1]?.html).toContain("/rechnung");
  });

  it("label creation mails the tracking number once the order shipped", async () => {
    const statusLog = HAPPY_PATH.slice(0, HAPPY_PATH.indexOf("packed") + 1).map((status) => ({
      status,
      at: new Date(),
    }));
    const order = await OrderModel.create({
      orderNumber: "B-2026-900001",
      status: "packed",
      statusLog,
      customer: { ...CUSTOMER, email: "versand@example.ch" },
      lines: [
        {
          productId: "000000000000000000000000",
          sku: "ML-label",
          name: "Label Test",
          variantLabel: "128 GB",
          qty: 1,
          unitPriceCents: 1000,
          totalCents: 1000,
          weightGrams: 200,
        },
      ],
      totals: { subtotalCents: 1000, shippingCents: 490, totalCents: 1490, vatCents: 111 },
      shipping: { method: "standard" },
      payment: { method: "mock", reference: "P-MAIL" },
    });

    const label = await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(label.ok).toBe(true);
    const mails = await outbox("versand@example.ch");
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toBe("Ihre Sendung ist unterwegs");
    if (label.ok) expect(mails[0]?.html).toContain(label.trackingNumber);

    // Idempotent second call must not send the mail again.
    await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(await outbox("versand@example.ch")).toHaveLength(1);
  });

  it("marking a pickup order ready mails the handover code", async () => {
    await seedProduct(5, "pickup");
    const result = await createOrderCore({
      lines: [{ sku: "ML-pickup", qty: 1, expectedUnitPriceCents: 10_000 }],
      customer: { ...CUSTOMER, email: "abholung@example.ch" },
      shippingMethod: "pickup",
      paymentMethod: "pickup",
    });
    expect(result.ok).toBe(true);
    const order = await OrderModel.findOne({ orderNumber: result.ok ? result.orderNumber : "" })
      .select("_id shipping.pickup.code")
      .lean()
      .exec();
    expect(await outbox("abholung@example.ch")).toHaveLength(1); // confirmation only so far

    const ready = await markPickupReadyCore(order!._id.toString(), "admin@example.ch");
    expect(ready.ok).toBe(true);
    const mails = await outbox("abholung@example.ch");
    expect(mails).toHaveLength(2);
    expect(mails[1]?.subject).toBe("Ihre Bestellung liegt bereit");
    expect(mails[1]?.html).toContain(order!.shipping.pickup?.code);
  });
});
