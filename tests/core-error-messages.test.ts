import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { ProductModel } from "@/models/product";
import { OrderModel, type Order } from "@/models/order";
import { UserModel } from "@/models/user";
import { hashPassword } from "@/server/password";
import {
  claimOrderCore,
  registerCustomerCore,
  resetCustomerRateLimits,
  resetPasswordCore,
  saveAddressCore,
} from "@/server/customers";
import { createOrderCore } from "@/server/checkout";
import { invalidateI18nCache } from "@/server/i18n";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step 3 (core-error slice): the customer-facing cores (register, reset,
// addresses, order claim, checkout, reviews, restock) answer their refusals from the
// translation table in the request language. The mock plays the request scope exactly
// like tests/request-language.test.ts — without it the first active language (German)
// answers, which is what the German specs rely on. Every French assertion here fails
// on the pre-change build, where these texts were hard-coded German literals.

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (request.cookie ? { value: request.cookie } : undefined),
  }),
  headers: async () => ({ get: () => null }),
}));

const CUSTOMER = {
  name: "Léa Test",
  email: "lea.core-errors@example.ch",
  phone: "079 555 00 42",
  street: "Rue de Test 3",
  postalCode: "1003",
  city: "Lausanne",
  country: "CH",
};

async function seedClothing(stock: number, tag: string, priceCents = 5_000) {
  await ProductModel.create({
    slug: `core-error-test-${tag}`,
    name: `Core Error Test ${tag}`,
    description: "Produkt für die Kernfehler-Integrationstests.",
    type: "clothing",
    brand: "Testmarke",
    priceCents,
    images: [{ src: `/products/core-error-test-${tag}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { color: ["blau"], size: ["M"], storage: [], material: [] },
    variants: [
      {
        sku: `CE-${tag}`,
        label: "M / blau",
        priceDeltaCents: 0,
        stock,
        restockThreshold: 3,
        weightGrams: 300,
        attributes: { color: "blau", size: "M" },
      },
    ],
  });
}

function makeOrderFixture(orderNumber: string, email: string): mongoose.mongo.OptionalId<Order> {
  const now = new Date();
  return {
    orderNumber,
    status: "paid",
    statusLog: [
      { status: "new", at: now },
      { status: "paid", at: now },
    ],
    customer: {
      name: "Fremd Käufer",
      email,
      phone: "079 222 11 00",
      street: "Andersweg 9",
      postalCode: "3000",
      city: "Bern",
      country: "CH",
    },
    lines: [],
    totals: { subtotalCents: 1000, shippingCents: 0, totalCents: 1000, vatCents: 75 },
    shipping: { method: "standard" },
    payment: { method: "mock", kind: "immediate", reference: `P-${orderNumber}` },
    createdAt: now,
    updatedAt: now,
  };
}

function checkout(sku: string, qty: number, paymentMethod: string, userId?: string) {
  return createOrderCore(
    {
      lines: [{ sku, qty, expectedUnitPriceCents: 5_000 }],
      customer: CUSTOMER,
      shippingMethod: "standard",
      paymentMethod,
    },
    { userId },
  );
}

beforeAll(async () => {
  await connectTestDB();
  await clearCollections();
  invalidateI18nCache();
});

afterEach(() => {
  request.cookie = undefined;
  resetCustomerRateLimits();
});

afterAll(async () => {
  invalidateI18nCache();
  await disconnectTestDB();
});

describe("register refusals follow the request language", () => {
  it("the duplicate refusal answers in French and keeps the machine-readable reason", async () => {
    const input = {
      name: "Léa Test",
      email: "dup.core@example.ch",
      password: "Sicheres123",
      consent: true,
    };
    const first = await registerCustomerCore(input);
    expect(first.ok).toBe(true);

    request.cookie = "fr";
    const second = await registerCustomerCore(input);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("Cette adresse e-mail est déjà enregistrée.");
    expect(second.reason).toBe("emailTaken");
  });

  it("the German base stays byte-identical for the German specs", async () => {
    request.cookie = undefined;
    const second = await registerCustomerCore({
      name: "Léa Test",
      email: "dup.core@example.ch",
      password: "Sicheres123",
      consent: true,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe("Diese E-Mail-Adresse ist bereits registriert.");
  });
});

describe("reset refusals follow the request language", () => {
  it("an invalid reset link is explained in French", async () => {
    request.cookie = "fr";
    const result = await resetPasswordCore("gibts-nicht", "Sicheres123");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Le lien est non valide ou expiré.");
  });
});

describe("address refusals follow the request language", () => {
  const address = {
    label: "Bureau",
    street: "Rue de Test 3",
    postalCode: "1003",
    city: "Lausanne",
    country: "CH",
    kind: "shipping",
    isDefault: true,
  };

  it("the address ceiling interpolates {max} in both languages", async () => {
    const user = await UserModel.create({
      email: "addresses.core@example.ch",
      name: "Ada Adress",
      passwordHash: await hashPassword("Sicheres123"),
      role: "customer",
      addresses: Array.from({ length: 10 }, (_, i) => ({
        ...address,
        label: `Nr ${i}`,
        isDefault: i === 0,
      })),
    });
    const userId = user._id.toString();

    request.cookie = "fr";
    const french = await saveAddressCore(userId, { ...address, label: "Onzième" });
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Maximum 10 adresses.");

    request.cookie = undefined;
    const german = await saveAddressCore(userId, { ...address, label: "Elfte" });
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Maximal 10 Adressen.");
  });

  it("a missing address is reported in French", async () => {
    const user = await UserModel.create({
      email: "missing.core@example.ch",
      name: "Moritz Adress",
      passwordHash: await hashPassword("Sicheres123"),
      role: "customer",
      addresses: [],
    });
    request.cookie = "fr";
    const result = await saveAddressCore(
      new mongoose.Types.ObjectId().toString(),
      address,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Compte introuvable.");
    const foreign = await saveAddressCore(user._id.toString(), address, "000000000000000000000000");
    expect(foreign.ok).toBe(false);
    if (foreign.ok) return;
    expect(foreign.error).toBe("Adresse introuvable.");
  });
});

describe("order claim refusals follow the request language", () => {
  it("the e-mail mismatch is explained in French", async () => {
    const user = await UserModel.create({
      email: "claim.core@example.ch",
      name: "Carla Claim",
      passwordHash: await hashPassword("Sicheres123"),
      role: "customer",
    });
    await OrderModel.create(
      makeOrderFixture("B-2099-900001", "fremd.core@example.ch"),
    );
    request.cookie = "fr";
    const result = await claimOrderCore(user._id.toString(), {
      orderNumber: "B-2099-900001",
      email: "claim.core@example.ch",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("L'e-mail de la commande ne correspond pas à votre compte.");
  });

  it("an unknown order number is reported in French", async () => {
    const user = await UserModel.create({
      email: "claim2.core@example.ch",
      name: "Ben Claim",
      passwordHash: await hashPassword("Sicheres123"),
      role: "customer",
    });
    request.cookie = "fr";
    const result = await claimOrderCore(user._id.toString(), {
      orderNumber: "B-2099-999999",
      email: "claim2.core@example.ch",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Commande introuvable. Veuillez vérifier le numéro.");
  });
});

describe("checkout refusals follow the request language", () => {
  it("the guest invoice refusal answers in French", async () => {
    await seedClothing(10, "guest-fr");
    request.cookie = "fr";
    const result = await checkout("CE-guest-fr", 1, "invoice");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(
      "Le paiement sur facture est réservé aux clients enregistrés. Veuillez vous connecter ou choisir un autre mode de paiement.",
    );
  });

  it("the stock refusal interpolates {sku} in both languages", async () => {
    await seedClothing(1, "stock");
    request.cookie = "fr";
    const french = await checkout("CE-stock", 5, "mock");
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Stock insuffisant pour CE-stock. Veuillez réduire la quantité.");

    request.cookie = undefined;
    const german = await checkout("CE-stock", 5, "mock");
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Nicht genügend Lager für CE-stock. Bitte Menge reduzieren.");
  });

  it("a vanished shipping method is refused in French", async () => {
    await seedClothing(10, "shipping-fr");
    request.cookie = "fr";
    const result = await checkout("CE-shipping-fr", 1, "mock");
    expect(result.ok).toBe(true);
    const gone = await createOrderCore(
      {
        lines: [{ sku: "CE-shipping-fr", qty: 1, expectedUnitPriceCents: 5_000 }],
        customer: CUSTOMER,
        shippingMethod: "versand-gibts-nicht",
        paymentMethod: "mock",
      },
      {},
    );
    expect(gone.ok).toBe(false);
    if (gone.ok) return;
    expect(gone.error).toBe(
      "Ce mode d'expédition n'est plus disponible. Veuillez recharger la page.",
    );
  });
});
