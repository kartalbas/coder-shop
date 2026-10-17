import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  ORDER_STATUSES,
  allowedTransitions,
  canTransition,
  isLabelOnlyTransition,
  transition,
  transitionsWithRestock,
  type OrderLike,
  type OrderStatus,
} from "./state-machine";

const ALLOWED: [OrderStatus, OrderStatus][] = [
  ["new", "paid"],
  ["new", "cancelled"],
  ["paid", "picking"],
  ["paid", "cancelled"],
  ["picking", "packed"],
  ["picking", "cancelled"],
  ["packed", "shipped"],
  ["shipped", "delivered"],
];

const ALLOWED_KEYS = new Set(ALLOWED.map(([from, to]) => `${from}→${to}`));

describe("canTransition — full graph", () => {
  it.each(ALLOWED)("%s → %s is allowed", (from, to) => {
    expect(canTransition(from, to, { viaLabel: true })).toBe(true);
  });

  it("rejects every other pair (including same-state)", () => {
    const rejected: [OrderStatus, OrderStatus][] = [];
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (!ALLOWED_KEYS.has(`${from}→${to}`)) rejected.push([from, to]);
      }
    }
    expect(rejected.length).toBe(ORDER_STATUSES.length ** 2 - ALLOWED.length);
    for (const [from, to] of rejected) {
      expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
    }
  });

  it("packed → shipped is label-only (issue #10)", () => {
    expect(isLabelOnlyTransition("packed", "shipped")).toBe(true);
    expect(isLabelOnlyTransition("paid", "shipped")).toBe(false);
    expect(canTransition("packed", "shipped")).toBe(false);
    expect(canTransition("packed", "shipped", { viaLabel: true })).toBe(true);
    expect(() => transition({ status: "packed", statusLog: [] }, "shipped")).toThrow(
      IllegalTransitionError,
    );
    const next = transition(
      { status: "packed", statusLog: [] },
      "shipped",
      { viaLabel: true, note: "UPS-Sendung 1Z" },
    );
    expect(next.status).toBe("shipped");
  });

  it("the admin UI never offers the label-only transition", () => {
    expect(allowedTransitions("packed")).toEqual([]);
    expect(allowedTransitions("picking")).toEqual(["packed", "cancelled"]);
  });

  it("cancelled is reachable exactly from new, paid and picking", () => {
    const fromCancelled = ORDER_STATUSES.filter((from) => canTransition(from, "cancelled"));
    expect(fromCancelled).toEqual(["new", "paid", "picking"]);
  });

  it("cancelled and delivered are terminal", () => {
    expect(allowedTransitions("cancelled")).toEqual([]);
    expect(allowedTransitions("delivered")).toEqual([]);
  });

  it("new → picking is invoice-only (issue #40)", () => {
    expect(canTransition("new", "picking")).toBe(false);
    expect(canTransition("new", "picking", { paymentMethod: "mock" })).toBe(false);
    expect(canTransition("new", "picking", { paymentMethod: "invoice" })).toBe(true);
    expect(() => transition({ status: "new", statusLog: [] }, "picking")).toThrow(
      IllegalTransitionError,
    );
    const next = transition(
      { status: "new", statusLog: [], paymentMethod: "invoice" },
      "picking",
      { paymentMethod: "invoice" },
    );
    expect(next.status).toBe("picking");
  });

  it("an invoice order reaches paid only through the invoice payment (issue #40)", () => {
    expect(canTransition("new", "paid", { paymentMethod: "invoice" })).toBe(false);
    expect(
      canTransition("new", "paid", { paymentMethod: "invoice", viaInvoicePayment: true }),
    ).toBe(true);
    // A card order's plain new → paid stays untouched.
    expect(canTransition("new", "paid", { paymentMethod: "mock" })).toBe(true);
  });

  it("the admin buttons follow the payment method (issue #40)", () => {
    expect(allowedTransitions("new")).toEqual(["paid", "cancelled"]);
    expect(allowedTransitions("new", { paymentMethod: "mock" })).toEqual(["paid", "cancelled"]);
    expect(allowedTransitions("new", { paymentMethod: "invoice" })).toEqual([
      "picking",
      "cancelled",
    ]);
  });

  it("the pickup chain is pickup-only and handover-gated (issue #41)", () => {
    // Without the pickup context none of the new edges exists.
    expect(canTransition("new", "ready")).toBe(false);
    expect(canTransition("picking", "ready")).toBe(false);
    expect(canTransition("ready", "picked_up")).toBe(false);
    expect(canTransition("ready", "cancelled")).toBe(false);

    // With pickup shipping the chain opens — except the handover itself.
    expect(canTransition("new", "ready", { shippingMethod: "pickup" })).toBe(true);
    expect(canTransition("picking", "ready", { shippingMethod: "pickup" })).toBe(true);
    expect(canTransition("ready", "cancelled", { shippingMethod: "pickup" })).toBe(true);
    expect(canTransition("ready", "picked_up", { shippingMethod: "pickup" })).toBe(false);
    expect(
      canTransition("ready", "picked_up", { shippingMethod: "pickup", viaPickupHandover: true }),
    ).toBe(true);

    // A pickup order never enters the parcel chain.
    expect(canTransition("picking", "packed", { shippingMethod: "pickup" })).toBe(false);
    expect(canTransition("packed", "shipped", { shippingMethod: "pickup", viaLabel: true })).toBe(
      false,
    );
    // And a parcel order never enters the pickup chain.
    expect(canTransition("picking", "ready", { shippingMethod: "standard" })).toBe(false);

    // Unpaid processing also covers pickup payment; new → paid is closed for it.
    expect(canTransition("new", "picking", { paymentMethod: "pickup" })).toBe(true);
    expect(canTransition("new", "paid", { paymentMethod: "pickup" })).toBe(false);
  });

  it("the admin buttons show the pickup chain only for pickup orders", () => {
    expect(allowedTransitions("new", { shippingMethod: "pickup", paymentMethod: "pickup" })).toEqual(
      ["picking", "ready", "cancelled"],
    );
    expect(allowedTransitions("picking", { shippingMethod: "pickup" })).toEqual([
      "ready",
      "cancelled",
    ]);
    // The handover is never a button — it records the payment in the pickup queue.
    expect(allowedTransitions("ready", { shippingMethod: "pickup" })).toEqual(["cancelled"]);
    expect(allowedTransitions("picked_up")).toEqual([]);
  });
});

describe("transitionsWithRestock", () => {
  it.each(["new", "paid", "picking", "ready"] as OrderStatus[])(
    "cancel from %s restocks",
    (from) => {
      expect(transitionsWithRestock(from, "cancelled")).toBe(true);
    },
  );

  it.each(["packed", "shipped", "delivered", "cancelled"] as OrderStatus[])(
    "cancel from %s does not restock (not allowed at all)",
    (from) => {
      expect(transitionsWithRestock(from, "cancelled")).toBe(false);
    },
  );
});

describe("transition", () => {
  const order: OrderLike = { status: "new", statusLog: [{ status: "new", at: new Date("2026-01-01") }] };
  const at = new Date("2026-01-02T10:00:00Z");

  it("sets the status and appends a log entry", () => {
    const next = transition(order, "paid", { at, note: "Mock-Zahlung", by: "system" });
    expect(next.status).toBe("paid");
    expect(next.statusLog).toHaveLength(2);
    expect(next.statusLog[1]).toEqual({ status: "paid", at, note: "Mock-Zahlung", by: "system" });
  });

  it("does not mutate the input order", () => {
    transition(order, "paid", { at });
    expect(order.status).toBe("new");
    expect(order.statusLog).toHaveLength(1);
  });

  it("omits note/by when not given", () => {
    const next = transition(order, "paid", { at });
    expect(next.statusLog[1]).toEqual({ status: "paid", at });
  });

  it("throws IllegalTransitionError on an illegal edge", () => {
    expect(() => transition(order, "shipped")).toThrow(IllegalTransitionError);
  });

  it("throws on a same-state transition", () => {
    const paid: OrderLike = { status: "paid", statusLog: [] };
    expect(() => transition(paid, "paid")).toThrow(IllegalTransitionError);
  });

  it("walks the full happy path with one log entry per step", () => {
    let o: OrderLike = { status: "new", statusLog: [] };
    for (const to of ["paid", "picking", "packed", "shipped", "delivered"] as OrderStatus[]) {
      o = transition(o, to, { viaLabel: true });
    }
    expect(o.status).toBe("delivered");
    expect(o.statusLog.map((e) => e.status)).toEqual([
      "paid",
      "picking",
      "packed",
      "shipped",
      "delivered",
    ]);
  });
});
