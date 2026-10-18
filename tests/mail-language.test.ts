import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HAPPY_PATH } from "@/lib/orders/state-machine";
import { labelMap } from "@/lib/i18n";
import { MailMessageModel } from "@/models/mail-message";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { RestockAlertModel } from "@/models/restock-alert";
import { UserModel } from "@/models/user";
import { createOrderCore } from "@/server/checkout";
import { adminResetPasswordCore } from "@/server/customers-admin";
import { registerCustomerCore, requestPasswordResetCore, resetCustomerRateLimits } from "@/server/customers";
import { sendInvoiceReminderCore } from "@/server/invoices";
import { markPickupReadyCore } from "@/server/pickup";
import { notifyRestockedCore, subscribeRestockAlertCore } from "@/server/restock-alerts";
import { createLabelCore } from "@/server/shipping/label";
import { MockUpsProvider } from "@/server/shipping/mock";
import { DEFAULT_TRANSLATIONS } from "@/server/translation-seed";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";
import { seedUnitsForSku } from "@/test/units";

// Issue #58 decision point 3: language is stored where the request happens (checkout,
// subscribe, register) and mails render from it later — admin-triggered mails use the
// *order's* or *account's* language, never the admin's. The mock plays the request
// scope the same way request-language.test.ts does; no cookie means the German admin.

const request = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (request.cookie ? { value: request.cookie } : undefined),
  }),
  headers: async () => ({ get: () => null }),
}));

const frLabels = labelMap(DEFAULT_TRANSLATIONS, "fr");

const CUSTOMER = {
  name: "Lang Person",
  email: "langue@example.ch",
  phone: "079 111 22 33",
  street: "Chemin d'Essai 5",
  postalCode: "1003",
  city: "Lausanne",
  country: "CH",
};

async function seedProduct(stock: number, tag: string) {
  await ProductModel.create({
    slug: `lang-test-${tag}`,
    name: `Lang Test ${tag}`,
    description: "Produkt für Sprach-Integrationstests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents: 10_000,
    images: [{ src: `/products/lang-test-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { color: ["schwarz"], size: [], storage: ["128"], material: [] },
    variants: [
      {
        sku: `LN-${tag}`,
        label: "128 GB / schwarz",
        priceDeltaCents: 0,
        stock,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
  await seedUnitsForSku(`LN-${tag}`, stock);
}

async function outbox(to: string) {
  return MailMessageModel.find({ to }).sort({ _id: 1 }).lean().exec();
}

beforeAll(async () => {
  await connectTestDB();
  await clearCollections();
  resetCustomerRateLimits();
});

afterEach(() => {
  request.cookie = undefined;
});

afterAll(disconnectTestDB);

describe("checkout stores the language and mails in it", () => {
  it("a French checkout stores fr and answers French confirmation and invoice mails", async () => {
    await seedProduct(5, "confirm");
    request.cookie = "fr";
    const result = await createOrderCore({
      lines: [{ sku: "LN-confirm", qty: 1, expectedUnitPriceCents: 10_000 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await OrderModel.findOne({ orderNumber: result.orderNumber }).lean().exec();
    expect(order?.language).toBe("fr");

    const mails = await outbox(CUSTOMER.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toBe(frLabels["mail.confirm.subject"]);
    expect(mails[0]?.html).toContain('lang="fr"');
    expect(mails[0]?.html).toContain(`/fr/orders/${result.orderNumber}`);
    expect(mails[0]?.html).not.toContain("Vielen Dank");
  });

  it("the invoice mail carries the fr-CH-formatted due date", async () => {
    const user = await UserModel.create({
      email: "facture@example.ch",
      name: "Facture Person",
      passwordHash: "x",
      role: "customer",
      addresses: [],
    });
    await seedProduct(5, "invoice");
    request.cookie = "fr";
    const result = await createOrderCore(
      {
        lines: [{ sku: "LN-invoice", qty: 1, expectedUnitPriceCents: 10_000 }],
        customer: { ...CUSTOMER, email: "facture@example.ch" },
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(result.ok).toBe(true);
    const mails = await outbox("facture@example.ch");
    expect(mails.map((m) => m.subject)).toEqual([
      frLabels["mail.confirm.subject"],
      frLabels["mail.invoice.subject"],
    ]);
    const order = await OrderModel.findOne({
      orderNumber: result.ok ? result.orderNumber : "",
    })
      .select("payment.invoice.dueAt")
      .lean()
      .exec();
    const due = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long" }).format(
      order!.payment.invoice!.dueAt,
    );
    expect(mails[1]?.text).toContain(due);
    expect(mails[1]?.html).toContain("/fr/orders/");
  });
});

describe("admin-triggered mails use the stored language, not the admin's", () => {
  it("a German admin creating the label mails the French customer", async () => {
    const statusLog = HAPPY_PATH.slice(0, HAPPY_PATH.indexOf("packed") + 1).map((status) => ({
      status,
      at: new Date(),
    }));
    const order = await OrderModel.create({
      orderNumber: "B-2026-910001",
      status: "packed",
      statusLog,
      language: "fr",
      customer: { ...CUSTOMER, email: "expedition@example.ch" },
      lines: [
        {
          productId: "000000000000000000000000",
          sku: "LN-label",
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
      payment: { method: "mock", kind: "immediate" as const, reference: "P-LANG" },
    });

    // No cookie — the admin session is German; the mail follows the order.
    const label = await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(label.ok).toBe(true);
    const mails = await outbox("expedition@example.ch");
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toBe(frLabels["mail.shipped.subject"]);
    expect(mails[0]?.html).toContain("/fr/orders/B-2026-910001");
  });

  it("pickup-ready and the invoice reminder answer in the order's language", async () => {
    await seedProduct(5, "pickup");
    request.cookie = "fr";
    const pickup = await createOrderCore({
      lines: [{ sku: "LN-pickup", qty: 1, expectedUnitPriceCents: 10_000 }],
      customer: { ...CUSTOMER, email: "retrait@example.ch" },
      shippingMethod: "pickup",
      paymentMethod: "pickup",
    });
    expect(pickup.ok).toBe(true);
    const pickupOrder = await OrderModel.findOne({
      orderNumber: pickup.ok ? pickup.orderNumber : "",
    })
      .select("_id")
      .lean()
      .exec();

    const user = await UserModel.create({
      email: "rappel@example.ch",
      name: "Rappel Person",
      passwordHash: "x",
      role: "customer",
      addresses: [],
    });
    await seedProduct(5, "reminder");
    const invoice = await createOrderCore(
      {
        lines: [{ sku: "LN-reminder", qty: 1, expectedUnitPriceCents: 10_000 }],
        customer: { ...CUSTOMER, email: "rappel@example.ch" },
        shippingMethod: "standard",
        paymentMethod: "invoice",
      },
      { userId: user._id.toString() },
    );
    expect(invoice.ok).toBe(true);
    const invoiceOrder = await OrderModel.findOne({
      orderNumber: invoice.ok ? invoice.orderNumber : "",
    })
      .select("_id")
      .lean()
      .exec();
    // Overdue now — the reminder is allowed.
    await OrderModel.updateOne(
      { _id: invoiceOrder!._id },
      { $set: { "payment.invoice.dueAt": new Date(Date.now() - 5 * 24 * 3600 * 1000) } },
    );

    // The German admin triggers both flows.
    request.cookie = undefined;
    expect((await markPickupReadyCore(pickupOrder!._id.toString(), "admin@example.ch")).ok).toBe(
      true,
    );
    expect((await sendInvoiceReminderCore(invoiceOrder!._id.toString(), 1)).ok).toBe(true);

    const pickupMails = await outbox("retrait@example.ch");
    expect(pickupMails.at(-1)?.subject).toBe(frLabels["mail.pickup.subject"]);
    const reminderMails = await outbox("rappel@example.ch");
    expect(reminderMails.at(-1)?.subject).toBe("1e relance");
  });
});

describe("restock alerts and accounts answer in the stored language", () => {
  it("a French subscription stores fr and the restock mail is French", async () => {
    await seedProduct(0, "restock");
    request.cookie = "fr";
    expect(await subscribeRestockAlertCore("LN-restock", "attente@example.ch")).toEqual({
      ok: true,
      inStock: false,
    });
    const alert = await RestockAlertModel.findOne({ sku: "LN-restock" }).lean().exec();
    expect(alert?.language).toBe("fr");

    // Stock arrives (goods receipt path calls the same core); the admin is German.
    request.cookie = undefined;
    await ProductModel.updateOne(
      { slug: "lang-test-restock", "variants.sku": "LN-restock" },
      { $inc: { "variants.$.stock": 4 } },
    );
    expect(await notifyRestockedCore(["LN-restock"])).toBe(1);

    const mails = await outbox("attente@example.ch");
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toBe(frLabels["mail.restock.subject"]);
    expect(mails[0]?.text).toContain("/fr/products/lang-test-restock");
  });

  it("registration stores the language; welcome, self-service and admin resets use it", async () => {
    request.cookie = "fr";
    const registered = await registerCustomerCore({
      name: "Compte Person",
      email: "compte@example.ch",
      password: "UnMotDePasseFort1",
      consent: true,
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const user = await UserModel.findById(registered.userId).lean().exec();
    expect(user?.language).toBe("fr");

    const welcome = await outbox("compte@example.ch");
    expect(welcome).toHaveLength(1);
    expect(welcome[0]?.subject).toBe(frLabels["mail.welcome.subject"]);

    // The German admin triggers the reset — the mail still renders French.
    request.cookie = undefined;
    expect((await adminResetPasswordCore(registered.userId)).ok).toBe(true);
    // And the self-service request from a German context too: the account decides.
    expect((await requestPasswordResetCore("compte@example.ch")).ok).toBe(true);

    const mails = await outbox("compte@example.ch");
    expect(mails).toHaveLength(3);
    expect(mails[1]?.subject).toBe(frLabels["mail.reset.subject"]);
    expect(mails[1]?.html).toContain("/fr/account/reset-password?token=");
    expect(mails[2]?.subject).toBe(frLabels["mail.reset.subject"]);
  });
});
