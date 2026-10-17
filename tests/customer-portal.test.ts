import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { canViewOrderDetails } from "@/lib/order-visibility";
import { MailMessageModel } from "@/models/mail-message";
import { OrderModel, type Order } from "@/models/order";
import { PasswordResetModel } from "@/models/password-reset";
import { UserModel } from "@/models/user";
import { hashPassword, verifyPassword } from "@/server/password";
import {
  claimOrderCore,
  deleteAddressCore,
  getCustomerProfile,
  registerCustomerCore,
  requestPasswordResetCore,
  resetCustomerRateLimits,
  resetPasswordCore,
  saveAddressCore,
} from "@/server/customers";
import { listAccountOrders } from "@/server/account";
import { customerLoginCore, loginCore, revokeSessionsCore } from "@/server/session";
import { createSessionToken } from "@/server/session-token";
import { resolveSessionUserId } from "@/server/session";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const PASSWORD = "Sicheres123";

function makeOrderFixture(
  orderNumber: string,
  email: string,
  userId?: mongoose.Types.ObjectId,
): mongoose.mongo.OptionalId<Order> {
  const now = new Date();
  return {
    orderNumber,
    status: "paid",
    statusLog: [
      { status: "new", at: now },
      { status: "paid", at: now },
    ],
    ...(userId !== undefined && { userId }),
    customer: {
      name: "Neu Kunde",
      email,
      phone: "079 111 22 33",
      street: "Testweg 1",
      postalCode: "8000",
      city: "Zürich",
      country: "CH",
    },
    lines: [],
    totals: { subtotalCents: 1000, shippingCents: 0, totalCents: 1000, vatCents: 75 },
    shipping: { method: "standard" },
    payment: { method: "mock", reference: `P-${orderNumber}` },
    createdAt: now,
    updatedAt: now,
  };
}

describe("canViewOrderDetails (issue #39, pure)", () => {
  const base = {
    hasAccessCookie: false,
    isAdmin: false,
    customerId: "u1",
    customerEmail: "max@example.ch",
    orderUserId: null,
    orderEmail: "max@example.ch",
  };

  it("lets the checkout browser and admins through", () => {
    expect(canViewOrderDetails({ ...base, hasAccessCookie: true })).toBe(true);
    expect(canViewOrderDetails({ ...base, isAdmin: true, customerId: null, customerEmail: null })).toBe(true);
  });

  it("lets the owning account through (linked or same e-mail)", () => {
    expect(canViewOrderDetails({ ...base, orderUserId: "u1" })).toBe(true);
    expect(canViewOrderDetails(base)).toBe(true);
  });

  it("keeps strangers and other accounts out", () => {
    expect(canViewOrderDetails({ ...base, customerId: null, customerEmail: null })).toBe(false);
    expect(canViewOrderDetails({ ...base, customerEmail: "andere@example.ch" })).toBe(false);
    expect(canViewOrderDetails({ ...base, orderUserId: "u2" })).toBe(false);
  });
});

describe("registerCustomerCore", () => {
  beforeAll(async () => {
    await connectTestDB();
    resetCustomerRateLimits();
  });
  afterAll(disconnectTestDB);

  beforeEach(async () => {
    await clearCollections();
    resetCustomerRateLimits();
  });

  it("creates a customer with a welcome mail in the outbox", async () => {
    const result = await registerCustomerCore({
      name: "Max Muster",
      email: "Max@Example.ch ",
      password: PASSWORD,
      consent: true,
    });
    expect(result.ok).toBe(true);
    const user = await UserModel.findOne({ email: "max@example.ch" }).exec();
    expect(user?.role).toBe("customer");
    expect(await verifyPassword(PASSWORD, user!.passwordHash)).toBe(true);

    const mails = await MailMessageModel.find().lean().exec();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("max@example.ch");
    expect(mails[0].subject).toContain("Willkommen");
  });

  it("rejects a duplicate e-mail (case-insensitively)", async () => {
    await registerCustomerCore({ name: "A B", email: "dup@example.ch", password: PASSWORD, consent: true });
    const second = await registerCustomerCore({
      name: "C D",
      email: "DUP@example.ch",
      password: PASSWORD,
      consent: true,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("bereits registriert");
    expect(await UserModel.countDocuments({ email: "dup@example.ch" })).toBe(1);
  });

  it("rejects weak passwords and missing consent", async () => {
    const weak = await registerCustomerCore({
      name: "A B",
      email: "weak@example.ch",
      password: "kurz",
      consent: true,
    });
    expect(weak.ok).toBe(false);

    const noConsent = await registerCustomerCore({
      name: "A B",
      email: "ok@example.ch",
      password: PASSWORD,
      consent: false,
    });
    expect(noConsent.ok).toBe(false);
    expect(await UserModel.countDocuments()).toBe(0);
  });
});

describe("customer vs admin login", () => {
  beforeAll(connectTestDB);
  afterAll(disconnectTestDB);

  beforeEach(async () => {
    await clearCollections();
    resetCustomerRateLimits();
    const hash = await hashPassword(PASSWORD);
    await UserModel.create([
      { email: "admin@codershop.ch", name: "Admin", passwordHash: hash, role: "admin" },
      { email: "kunde@example.ch", name: "Kunde", passwordHash: hash, role: "customer" },
    ]);
  });

  it("a customer password does not open the admin area", async () => {
    expect((await customerLoginCore("kunde@example.ch", PASSWORD)).ok).toBe(true);
    expect((await loginCore("kunde@example.ch", PASSWORD)).ok).toBe(false);
  });

  it("an admin account cannot log into the customer portal", async () => {
    expect((await loginCore("admin@codershop.ch", PASSWORD)).ok).toBe(true);
    expect((await customerLoginCore("admin@codershop.ch", PASSWORD)).ok).toBe(false);
  });

  it("a customer token never resolves for the admin scope and vice versa", async () => {
    const login = await customerLoginCore("kunde@example.ch", PASSWORD);
    if (!login.ok) throw new Error("login failed");
    expect(await resolveSessionUserId(login.token, "customer")).not.toBeNull();
    expect(await resolveSessionUserId(login.token, "admin")).toBeNull();

    const adminLogin = await loginCore("admin@codershop.ch", PASSWORD);
    if (!adminLogin.ok) throw new Error("admin login failed");
    expect(await resolveSessionUserId(adminLogin.token, "admin")).not.toBeNull();
    expect(await resolveSessionUserId(adminLogin.token, "customer")).toBeNull();
  });

  it("logout revokes the customer session too", async () => {
    const login = await customerLoginCore("kunde@example.ch", PASSWORD);
    if (!login.ok) throw new Error("login failed");
    const user = await UserModel.findOne({ email: "kunde@example.ch" }).exec();
    await revokeSessionsCore(user!._id.toString());
    expect(await resolveSessionUserId(login.token, "customer")).toBeNull();
    // A token issued after the revocation works again.
    const fresh = createSessionToken((await UserModel.findOne({ email: "kunde@example.ch" }))!._id.toString(), 3600, "customer");
    expect(await resolveSessionUserId(fresh, "customer")).not.toBeNull();
  });
});

describe("password reset", () => {
  beforeAll(connectTestDB);
  afterAll(disconnectTestDB);

  beforeEach(async () => {
    await clearCollections();
    resetCustomerRateLimits();
    await UserModel.create({
      email: "vergisst@example.ch",
      name: "Vergissmeinnicht",
      passwordHash: await hashPassword(PASSWORD),
      role: "customer",
    });
  });

  async function latestResetLink(): Promise<string> {
    const mail = await MailMessageModel.findOne({ subject: /Passwort/ }).sort({ sentAt: -1 }).lean().exec();
    if (!mail) throw new Error("no reset mail");
    const match = mail.text.match(/token=([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("no token in mail");
    return match[1];
  }

  it("sends a link that stores only a hash and resets the password once", async () => {
    const request = await requestPasswordResetCore("vergisst@example.ch");
    expect(request.ok).toBe(true);
    expect(await PasswordResetModel.countDocuments()).toBe(1);
    const stored = await PasswordResetModel.findOne().lean().exec();
    expect(stored!._id).toMatch(/^[0-9a-f]{64}$/); // only the SHA-256 lives in the DB

    const token = await latestResetLink();
    const result = await resetPasswordCore(token, "NeuesPasswort1");
    expect(result.ok).toBe(true);
    const user = await UserModel.findOne({ email: "vergisst@example.ch" }).exec();
    expect(await verifyPassword("NeuesPasswort1", user!.passwordHash)).toBe(true);
    expect(user!.sessionsInvalidBefore).toBeInstanceOf(Date);

    // Single-use: the same token fails a second time.
    const again = await resetPasswordCore(token, "NochEinPasswort1");
    expect(again.ok).toBe(false);
  });

  it("unknown e-mails get the same answer and no mail", async () => {
    const result = await requestPasswordResetCore("unbekannt@example.ch");
    expect(result.ok).toBe(true);
    expect(await MailMessageModel.countDocuments()).toBe(0);
    expect(await PasswordResetModel.countDocuments()).toBe(0);
  });

  it("rejects expired and malformed tokens", async () => {
    await requestPasswordResetCore("vergisst@example.ch");
    await PasswordResetModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const token = await latestResetLink();
    expect((await resetPasswordCore(token, "NeuesPasswort1")).ok).toBe(false);
    expect((await resetPasswordCore("unsinn", "NeuesPasswort1")).ok).toBe(false);
  });
});

describe("addresses, claim and order list", () => {
  beforeAll(connectTestDB);
  afterAll(disconnectTestDB);

  beforeEach(async () => {
    await clearCollections();
    resetCustomerRateLimits();
  });

  async function makeCustomer(email: string): Promise<string> {
    const result = await registerCustomerCore({
      name: "Konto Inhaber",
      email,
      password: PASSWORD,
      consent: true,
    });
    if (!result.ok) throw new Error("registration failed");
    return result.userId;
  }

  it("saves addresses, keeps one default per kind, edits and deletes", async () => {
    const userId = await makeCustomer("adressen@example.ch");
    expect(
      (await saveAddressCore(userId, { label: "Zuhause", street: "Bahnhofstrasse 1", postalCode: "8001", city: "Zürich", kind: "shipping", isDefault: true })).ok,
    ).toBe(true);
    expect(
      (await saveAddressCore(userId, { label: "Büro", street: "Langstrasse 2", postalCode: "8004", city: "Zürich", kind: "shipping", isDefault: true })).ok,
    ).toBe(true);

    let profile = await getCustomerProfile(userId);
    expect(profile!.addresses).toHaveLength(2);
    const defaults = profile!.addresses.filter((a) => a.isDefault && a.kind === "shipping");
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe("Büro");

    const buero = profile!.addresses.find((a) => a.label === "Büro")!;
    expect(
      (await saveAddressCore(userId, { label: "Büro Neu", street: buero.street, postalCode: buero.postalCode, city: buero.city, kind: "shipping", isDefault: false }, buero.id)).ok,
    ).toBe(true);
    profile = await getCustomerProfile(userId);
    expect(profile!.addresses.some((a) => a.label === "Büro Neu")).toBe(true);

    expect((await deleteAddressCore(userId, buero.id)).ok).toBe(true);
    expect((await deleteAddressCore(userId, buero.id)).ok).toBe(false);
    expect((await getCustomerProfile(userId))!.addresses).toHaveLength(1);
  });

  it("rejects invalid addresses", async () => {
    const userId = await makeCustomer("ungueltig@example.ch");
    const result = await saveAddressCore(userId, {
      label: "Falsch",
      street: "Zu kurz",
      postalCode: "12",
      city: "Zürich",
      kind: "shipping",
      isDefault: false,
    });
    expect(result.ok).toBe(false);
  });

  it("claims a guest order with the matching e-mail only", async () => {
    const userId = await makeCustomer("anspruch@example.ch");
    await OrderModel.insertMany([
      makeOrderFixture("B-2026-100001", "anspruch@example.ch"),
      makeOrderFixture("B-2026-100002", "fremd@example.ch"),
    ]);

    const wrong = await claimOrderCore(userId, { orderNumber: "B-2026-100002", email: "anspruch@example.ch" });
    expect(wrong.ok).toBe(false);

    const ok = await claimOrderCore(userId, { orderNumber: "B-2026-100001", email: "Anspruch@Example.ch" });
    expect(ok.ok).toBe(true);
    const order = await OrderModel.findOne({ orderNumber: "B-2026-100001" }).exec();
    expect(order!.userId!.toString()).toBe(userId);

    // An order that already belongs to someone else cannot be claimed.
    const other = await makeCustomer("anderer@example.ch");
    const stolen = await claimOrderCore(other, { orderNumber: "B-2026-100001", email: "anderer@example.ch" });
    expect(stolen.ok).toBe(false);
  });

  it("lists linked and same-e-mail orders newest first, with search", async () => {
    const userId = await makeCustomer("liste@example.ch");
    const day = 24 * 60 * 60 * 1000;
    const base = Date.now();
    await OrderModel.insertMany([
      { ...makeOrderFixture("B-2026-200001", "liste@example.ch"), createdAt: new Date(base - 2 * day) },
      { ...makeOrderFixture("B-2026-200002", "liste@example.ch", new mongoose.Types.ObjectId(userId)), createdAt: new Date(base - day) },
      { ...makeOrderFixture("B-2026-200003", "fremd@example.ch", new mongoose.Types.ObjectId(userId)), createdAt: new Date(base) },
    ]);

    const all = await listAccountOrders(userId);
    expect(all.map((o) => o.orderNumber)).toEqual(["B-2026-200003", "B-2026-200002", "B-2026-200001"]);

    const search = await listAccountOrders(userId, "200002");
    expect(search.map((o) => o.orderNumber)).toEqual(["B-2026-200002"]);

    const none = await listAccountOrders(userId, "gibtsnicht");
    expect(none).toHaveLength(0);
  });
});
