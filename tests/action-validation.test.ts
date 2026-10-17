import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UserModel } from "@/models/user";
import { hashPassword } from "@/server/password";
import { createSessionToken } from "@/server/session-token";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Server actions read the session via next/headers and revalidate caches — stub both so
// the boundary validation itself can be tested against the real DB.
const store = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (store.token ? { value: store.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { searchSkuAction, markPurchaseOrderOrderedAction } from "@/server/actions/admin/purchasing";
import { transitionOrderAction } from "@/server/actions/admin/orders";
import { updateVariantAction } from "@/server/actions/admin/products";

describe("admin action input validation (issue #9)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    const user = await UserModel.create({
      email: "admin@codershop.ch",
      name: "Shop Admin",
      passwordHash: await hashPassword("Action!2026"),
      role: "admin",
    });
    store.token = createSessionToken(user._id.toString());
  });

  afterAll(async () => {
    store.token = "";
    await disconnectTestDB();
  });

  it("searchSkuAction answers a non-string query with an empty list, not a 500", async () => {
    expect(await searchSkuAction(42 as unknown as string)).toEqual([]);
    expect(await searchSkuAction({} as unknown as string)).toEqual([]);
    expect(await searchSkuAction("x".repeat(500) as unknown as string)).toEqual([]);
    expect(await searchSkuAction("CT")).toEqual([]);
  });

  it("transitionOrderAction rejects a malformed order id with a validation error", async () => {
    const formData = new FormData();
    formData.set("orderId", "gibts-nicht");
    formData.set("to", "picking");
    const result = await transitionOrderAction(null, formData);
    expect(result.ok).toBeUndefined();
    expect(result.error).toBe("Ungültige Anfrage.");
  });

  it("updateVariantAction rejects non-string ids with a validation error", async () => {
    const formData = new FormData();
    formData.set("productId", "quatsch");
    formData.set("sku", "X-1");
    formData.set("payload", "{}");
    const result = await updateVariantAction(null, formData);
    expect(result.ok).toBeUndefined();
    expect(result.error).toBe("Ungültige Anfrage.");
  });

  it("markPurchaseOrderOrderedAction rejects a malformed PO id", async () => {
    const formData = new FormData();
    formData.set("poId", "keine-id");
    const result = await markPurchaseOrderOrderedAction(null, formData);
    expect(result.ok).toBeUndefined();
    expect(result.error).toBe("Ungültige Anfrage.");
  });
});
