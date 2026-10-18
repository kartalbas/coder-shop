import { describe, expect, it } from "vitest";
import {
  activePaymentMethods,
  activeShippingMethods,
  DEFAULT_SHOP_SETTINGS,
  paymentMethodByKey,
  paymentMethodsForShipping,
  shippingMethodByKey,
  vatLabel,
  type ShopSettings,
} from "./shop-settings";

const settings: ShopSettings = structuredClone(DEFAULT_SHOP_SETTINGS);

describe("active methods (issue #64)", () => {
  it("lists only active rows, in position order", () => {
    const edited: ShopSettings = {
      ...settings,
      shippingMethods: [
        { ...settings.shippingMethods[2]!, position: 0 },
        { ...settings.shippingMethods[0]!, active: false },
        settings.shippingMethods[1]!,
      ],
    };
    expect(activeShippingMethods(edited).map((m) => m.key)).toEqual(["pickup", "express"]);
    expect(activePaymentMethods(settings).map((m) => m.key)).toEqual(["mock", "invoice", "pickup"]);
  });

  it("look-ups find inactive rows too — booked orders stay readable", () => {
    const edited: ShopSettings = {
      ...settings,
      paymentMethods: settings.paymentMethods.map((m) => ({ ...m, active: false })),
    };
    expect(paymentMethodByKey(edited, "mock")?.label).toBe("Kreditkarte (Demo)");
    expect(paymentMethodByKey(edited, "twint")).toBeUndefined();
  });
});

describe("payment methods follow the shipping method (issues #41/#64)", () => {
  const pickup = shippingMethodByKey(settings, "pickup")!;
  const standard = shippingMethodByKey(settings, "standard")!;

  it("on-pickup payment exists only with store pickup", () => {
    const withPickup = paymentMethodsForShipping(settings, pickup).map((m) => m.key);
    expect(withPickup).toContain("pickup");
    expect(withPickup).not.toContain("invoice");
    const delivered = paymentMethodsForShipping(settings, standard).map((m) => m.key);
    expect(delivered).not.toContain("pickup");
    expect(delivered).toContain("invoice");
  });

  it("a runtime-added immediate method is offered for every shipping (done-when)", () => {
    const edited: ShopSettings = {
      ...settings,
      paymentMethods: [
        ...settings.paymentMethods,
        { key: "twint", label: "Twint (Demo)", position: 4, active: true, kind: "immediate" },
      ],
    };
    for (const shipping of [pickup, standard]) {
      expect(paymentMethodsForShipping(edited, shipping).map((m) => m.key)).toContain("twint");
    }
  });

  it("inactive methods are never offered", () => {
    const edited: ShopSettings = {
      ...settings,
      paymentMethods: settings.paymentMethods.map((m) =>
        m.key === "mock" ? { ...m, active: false } : m,
      ),
    };
    expect(paymentMethodsForShipping(edited, standard).map((m) => m.key)).not.toContain("mock");
  });
});

describe("VAT copy from the configured rate (issues #30/#64)", () => {
  it("formats with a German comma", () => {
    expect(vatLabel(8.1)).toBe("8,1 % MwSt.");
    expect(vatLabel(0)).toBe("0,0 % MwSt.");
  });
});
