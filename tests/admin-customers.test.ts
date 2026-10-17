import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MailMessageModel } from "@/models/mail-message";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { UserModel } from "@/models/user";
import {
  adminResetPasswordCore,
  getCustomerDetailCore,
  listCustomersCore,
  setCustomerBlockedCore,
  setCustomerNotesCore,
} from "@/server/customers-admin";
import { hashPassword } from "@/server/password";
import { customerLoginCore, resetLoginThrottle } from "@/server/session";
import { resetPasswordCore } from "@/server/customers";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const PASSWORD = "EinStarkesPasswort1";

async function makeCustomer(email: string, name: string, blocked = false) {
  return UserModel.create({
    email,
    name,
    passwordHash: await hashPassword(PASSWORD),
    role: "customer",
    addresses: [],
    blocked,
  });
}

async function seedProduct(sku: string, priceCents = 10_000) {
  await ProductModel.create({
    slug: `cust-${sku}`,
    name: `Kunde Test ${sku}`,
    description: "Produkt für Kundenkonto-Tests.",
    type: "smartphone",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/cust-${sku}-1.webp`, alt: "Test" }],
    featured: false,
    filter: {  color: ["schwarz"], size: [], storage: ["128"], material: []  },
    variants: [
      {
        sku,
        label: "128 GB",
        priceDeltaCents: 0,
        stock: 10,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

async function makeOrder(opts: {
  number: string;
  email: string;
  userId?: string;
  totalCents: number;
  invoice?: { paidCents: number };
  createdAt: Date;
}) {
  await OrderModel.create({
    orderNumber: opts.number,
    status: opts.invoice ? "new" : "paid",
    statusLog: [{ status: opts.invoice ? "new" : "paid", at: opts.createdAt }],
    ...(opts.userId !== undefined && { userId: opts.userId }),
    customer: {
      name: "Wer auch immer",
      email: opts.email,
      phone: "079 000 00 00",
      street: "Weg 1",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    },
    lines: [
      {
        productId: "000000000000000000000000",
        sku: "CUST-X",
        name: "Kunde Test",
        variantLabel: "128 GB",
        qty: 1,
        unitPriceCents: opts.totalCents,
        totalCents: opts.totalCents,
        weightGrams: 200,
      },
    ],
    totals: {
      subtotalCents: opts.totalCents,
      shippingCents: 0,
      totalCents: opts.totalCents,
      vatCents: 0,
    },
    shipping: { method: "standard" },
    payment: opts.invoice
      ? {
          method: "invoice",
          kind: "invoice" as const,
          reference: `P-${opts.number}`,
          invoice: { dueAt: new Date(Date.now() - 86_400_000), paidCents: opts.invoice.paidCents, qrReference: "RF0000" },
        }
      : { method: "mock", kind: "immediate" as const, reference: `P-${opts.number}`, paidAt: opts.createdAt },
  });
}

describe("admin customer management (issue #43)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await seedProduct("CUST-X");
    await UserModel.create({
      email: "admin@example.ch",
      name: "Shop Admin",
      passwordHash: await hashPassword(PASSWORD),
      role: "admin",
      addresses: [],
    });
  });

  afterAll(disconnectTestDB);

  it("lists customers with search, order counts and open invoice amounts", async () => {
    const anna = await makeCustomer("anna@example.ch", "Anna Beispiel");
    const ben = await makeCustomer("ben@example.ch", "Ben Andere");

    // Anna: one linked order, one guest order under her e-mail, one open invoice (30 of 100 paid).
    await makeOrder({ number: "B-2026-700001", email: anna.email, userId: anna._id.toString(), totalCents: 5000, createdAt: new Date() });
    await makeOrder({ number: "B-2026-700002", email: anna.email, totalCents: 7000, createdAt: new Date() });
    await makeOrder({ number: "B-2026-700003", email: anna.email, userId: anna._id.toString(), totalCents: 10_000, invoice: { paidCents: 3000 }, createdAt: new Date() });
    await makeOrder({ number: "B-2026-700004", email: ben.email, userId: ben._id.toString(), totalCents: 2000, createdAt: new Date() });

    const all = await listCustomersCore("");
    expect(all.map((row) => row.email)).toEqual(["anna@example.ch", "ben@example.ch"]); // admins are not customers
    const annaRow = all.find((row) => row.email === "anna@example.ch");
    expect(annaRow?.orderCount).toBe(3); // linked + guest-by-e-mail are summed
    expect(annaRow?.openInvoiceCents).toBe(7000);

    expect((await listCustomersCore("Ben")).map((row) => row.email)).toEqual(["ben@example.ch"]);
    expect((await listCustomersCore("anna@ex")).map((row) => row.email)).toEqual(["anna@example.ch"]);
    expect(await listCustomersCore("niemand")).toEqual([]);
  });

  it("detail carries orders newest-first, open invoices and credit; refuses unknown/admin ids", async () => {
    const anna = await UserModel.findOne({ email: "anna@example.ch" }).lean().exec();
    const detail = await getCustomerDetailCore(anna!._id.toString());
    expect(detail).not.toBeNull();
    expect(detail?.orders.map((order) => order.orderNumber)).toEqual([
      "B-2026-700003",
      "B-2026-700002",
      "B-2026-700001",
    ]);
    expect(detail?.openTotalCents).toBe(7000);
    expect(detail?.openInvoices[0]?.orderNumber).toBe("B-2026-700003");
    expect(detail?.openInvoices[0]?.orderId).toBeTruthy();
    expect(detail?.openInvoices[0]?.overdue).toBe(true);

    const admin = await UserModel.findOne({ email: "admin@example.ch" }).lean().exec();
    expect(await getCustomerDetailCore(admin!._id.toString())).toBeNull();
    expect(await getCustomerDetailCore("gibt-es-nicht")).toBeNull();
  });

  it("blocking refuses login and signs sessions out; unblocking restores access", async () => {
    const carla = await makeCustomer("carla@example.ch", "Carla Gesperrt");
    resetLoginThrottle();
    const before = await customerLoginCore("carla@example.ch", PASSWORD);
    expect(before.ok).toBe(true);

    expect((await setCustomerBlockedCore(carla._id.toString(), true)).ok).toBe(true);
    const blocked = await customerLoginCore("carla@example.ch", PASSWORD);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain("gesperrt");
    const stored = await UserModel.findById(carla._id).lean().exec();
    expect(stored?.sessionsInvalidBefore).toBeInstanceOf(Date);

    // Wrong password on a blocked account still gives the generic answer.
    resetLoginThrottle();
    const wrong = await customerLoginCore("carla@example.ch", "Falsch1234!");
    expect(!wrong.ok && wrong.error).toBe("E-Mail oder Passwort ist falsch.");

    expect((await setCustomerBlockedCore(carla._id.toString(), false)).ok).toBe(true);
    resetLoginThrottle();
    expect((await customerLoginCore("carla@example.ch", PASSWORD)).ok).toBe(true);

    // Admins cannot be blocked through this path; unknown ids are refused.
    const admin = await UserModel.findOne({ email: "admin@example.ch" }).lean().exec();
    expect((await setCustomerBlockedCore(admin!._id.toString(), true)).ok).toBe(false);
    expect((await setCustomerBlockedCore("kein-id", true)).ok).toBe(false);
  });

  it("notes save trimmed and refuse junk", async () => {
    const ben = await UserModel.findOne({ email: "ben@example.ch" }).lean().exec();
    expect((await setCustomerNotesCore(ben!._id.toString(), "  Kunde bittet um Rechnungsversand  ")).ok).toBe(true);
    const stored = await UserModel.findById(ben!._id).lean().exec();
    expect(stored?.notes).toBe("Kunde bittet um Rechnungsversand");
    expect((await setCustomerNotesCore("kein-id", "x")).ok).toBe(false);
    expect((await setCustomerNotesCore(ben!._id.toString(), "x".repeat(2001))).ok).toBe(false);
  });

  it("admin password reset mails a working single-use link", async () => {
    const ben = await UserModel.findOne({ email: "ben@example.ch" }).exec();
    expect((await adminResetPasswordCore(ben!._id.toString())).ok).toBe(true);

    const mail = await MailMessageModel.findOne({ to: "ben@example.ch", subject: "Passwort zurücksetzen" })
      .sort({ _id: -1 })
      .lean()
      .exec();
    expect(mail).not.toBeNull();
    const link = mail!.html.match(/token=([A-Za-z0-9_-]+)/)![1];

    expect((await resetPasswordCore(link, "NeuesStarkes1")).ok).toBe(true);
    expect((await resetPasswordCore(link, "NochEinStarkes1")).ok).toBe(false); // single-use
    resetLoginThrottle();
    expect((await customerLoginCore("ben@example.ch", "NeuesStarkes1")).ok).toBe(true);

    expect((await adminResetPasswordCore("kein-id")).ok).toBe(false);
  });
});
