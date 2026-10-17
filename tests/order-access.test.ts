import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { OrderModel, type Order } from "@/models/order";
import {
  orderAccessCookieName,
  resetOrderEmailThrottle,
  signOrderAccessToken,
  verifyOrderAccessToken,
  verifyOrderEmailCore,
} from "@/server/order-access";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

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
      name: "Lena Meier",
      email,
      phone: "079 555 01 10",
      street: "Bahnhofstrasse 12",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    },
    lines: [],
    totals: { subtotalCents: 0, shippingCents: 0, totalCents: 0, vatCents: 0 },
    shipping: { method: "standard" },
    payment: { method: "mock", kind: "immediate", reference: `P-${orderNumber}` },
    createdAt: now,
    updatedAt: now,
  };
}

describe("order access tokens", () => {
  it("round-trips a token for the same order number", () => {
    const token = signOrderAccessToken("B-2026-000001", "secret");
    expect(verifyOrderAccessToken("B-2026-000001", token, "secret")).toBe(true);
  });

  it("does not unlock another (guessable, sequential) order number", () => {
    const token = signOrderAccessToken("B-2026-000001", "secret");
    expect(verifyOrderAccessToken("B-2026-000002", token, "secret")).toBe(false);
  });

  it("rejects missing or tampered tokens", () => {
    const token = signOrderAccessToken("B-2026-000001", "secret");
    expect(verifyOrderAccessToken("B-2026-000001", undefined, "secret")).toBe(false);
    expect(verifyOrderAccessToken("B-2026-000001", "", "secret")).toBe(false);
    expect(verifyOrderAccessToken("B-2026-000001", `${token}x`, "secret")).toBe(false);
    expect(verifyOrderAccessToken("B-2026-000001", token, "anderes-secret")).toBe(false);
  });

  it("names the cookie after the order number", () => {
    expect(orderAccessCookieName("B-2026-000042")).toBe("order_access_B-2026-000042");
  });
});

describe("verifyOrderEmailCore", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await OrderModel.insertMany([
      makeOrderFixture("B-2026-000001", "lena.meier@example.ch"),
      makeOrderFixture("B-2026-000002", "luca.bianchi@example.ch"),
    ]);
  });

  afterAll(disconnectTestDB);

  beforeEach(() => {
    resetOrderEmailThrottle();
  });

  it("accepts the order's e-mail case-insensitively and with surrounding space", async () => {
    const result = await verifyOrderEmailCore("B-2026-000001", "  Lena.Meier@Example.CH ");
    expect(result.ok).toBe(true);
  });

  it("rejects a wrong e-mail with a generic message", async () => {
    const result = await verifyOrderEmailCore("B-2026-000001", "fremd@example.ch");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/nicht überein/);
  });

  it("rejects an unknown order number with the same message (no enumeration)", async () => {
    const unknown = await verifyOrderEmailCore("B-2026-999999", "lena.meier@example.ch");
    const wrong = await verifyOrderEmailCore("B-2026-000001", "fremd@example.ch");
    expect(unknown.ok).toBe(false);
    if (!unknown.ok && !wrong.ok) expect(unknown.error).toBe(wrong.error);
  });

  it("throttles repeated failures for one order", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await verifyOrderEmailCore("B-2026-000002", "falsch@example.ch")).ok).toBe(false);
    }
    const blocked = await verifyOrderEmailCore("B-2026-000002", "luca.bianchi@example.ch");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Zu viele Fehlversuche/);
  });
});
