import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { OrderModel } from "@/models/order";
import { getLabelFileCore, createLabelCore } from "@/server/shipping/label";
import { transitionOrderCore } from "@/server/orders-admin";
import { invalidateI18nCache } from "@/server/i18n";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step 2 (admin orders slice): the admin order and label cores answer their
// refusals from the translation table in the request language — the same discipline as
// tests/core-error-messages.test.ts. The mock plays the request scope (lang cookie);
// without it the first active language (German) answers, which is what the German
// specs and scripts rely on. Every French assertion here fails on the pre-change
// build, where these texts were hard-coded German literals.

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (request.cookie ? { value: request.cookie } : undefined),
  }),
  headers: async () => ({ get: () => null }),
}));

function orderFixture(orderNumber: string, status: "paid" | "packed") {
  const now = new Date();
  return {
    orderNumber,
    status,
    statusLog: [{ status: "new" as const, at: now }, { status, at: now }],
    customer: {
      name: "Anna Test",
      email: `admin-core-${orderNumber}@example.ch`,
      phone: "079 111 22 33",
      street: "Testweg 1",
      postalCode: "8000",
      city: "Zürich",
      country: "CH",
    },
    lines: [],
    totals: { subtotalCents: 1000, shippingCents: 0, totalCents: 1000, vatCents: 75 },
    shipping: { method: "standard" },
    payment: { method: "mock", kind: "immediate" as const, reference: `P-${orderNumber}` },
    createdAt: now,
    updatedAt: now,
  };
}

beforeAll(async () => {
  await connectTestDB();
  await clearCollections();
  invalidateI18nCache();
});

afterEach(() => {
  request.cookie = undefined;
});

afterAll(async () => {
  invalidateI18nCache();
  await disconnectTestDB();
});

describe("transitionOrderCore refusals follow the request language", () => {
  it("an invalid order id is refused in French", async () => {
    request.cookie = "fr";
    const result = await transitionOrderCore("kein-object-id", "picking");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Commande introuvable.");
  });

  it("a missing order is refused in French and in the German base", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();

    request.cookie = "fr";
    const french = await transitionOrderCore(missingId, "picking");
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Commande introuvable.");

    request.cookie = undefined;
    const german = await transitionOrderCore(missingId, "picking");
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Bestellung nicht gefunden.");
  });
});

describe("createLabelCore refusals follow the request language", () => {
  it("an unpacked order is refused in French", async () => {
    const created = await OrderModel.create(orderFixture("B-ADM-CORE-1", "paid"));

    request.cookie = "fr";
    const result = await createLabelCore(created._id.toString());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_packed");
    expect(result.error).toBe("Une étiquette ne peut être créée que pour les commandes emballées.");

    request.cookie = undefined;
    const german = await createLabelCore(created._id.toString());
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Ein Etikett kann nur für gepackte Bestellungen erstellt werden.");
  });

  it("a missing label file is explained in French", async () => {
    const created = await OrderModel.create(orderFixture("B-ADM-CORE-2", "packed"));

    request.cookie = "fr";
    const result = await getLabelFileCore(created._id.toString());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Aucune étiquette disponible.");
  });
});
