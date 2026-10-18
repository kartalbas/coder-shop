import { describe, expect, it } from "vitest";
import { BASE_LANGUAGE, DEFAULT_TRANSLATIONS, labelMap } from "@/lib/i18n";
import { createCheckoutSchema } from "@/lib/validations/checkout";
import {
  createAddressSchema,
  createAddressIdSchema,
  createCustomerLoginSchema,
  createRegisterSchema,
  validateCustomerPassword,
} from "@/lib/validations/account";
import { MAX_QTY_PER_SKU } from "@/lib/validations/checkout";

// Issue #58 step 3 (server-messages slice): the schemas are factories over the label
// map. These assertions fail without the change — before it the schemas were constants
// with hard-coded German, so a French label map could not influence them at all.

const de = labelMap(DEFAULT_TRANSLATIONS, BASE_LANGUAGE);
const fr = labelMap(DEFAULT_TRANSLATIONS, "fr");

const customer = {
  name: "",
  email: "kaputt",
  phone: "x",
  street: "a",
  postalCode: "12",
  city: "",
};

function checkoutPayload() {
  return {
    lines: [] as { sku: string; qty: number; expectedUnitPriceCents: number }[],
    customer,
    shippingMethod: "standard",
  };
}

function firstMessage(result: { success: false; error: { issues: { message: string }[] } }) {
  return result.error.issues[0].message;
}

describe("checkout schema messages follow the label map", () => {
  it("answers the byte-identical German bases", () => {
    const schema = createCheckoutSchema(de);
    const empty = schema.safeParse(checkoutPayload());
    expect(!empty.success && firstMessage(empty as never)).toBe("Der Warenkorb ist leer");
    const badCustomer = schema.safeParse({
      ...checkoutPayload(),
      lines: [{ sku: "A", qty: 1, expectedUnitPriceCents: 100 }],
    });
    expect(!badCustomer.success).toBe(true);
    const messages = badCustomer.success
      ? []
      : badCustomer.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Bitte Namen angeben");
    expect(messages).toContain("Bitte gültige E-Mail angeben");
    expect(messages).toContain("Bitte gültige Telefonnummer angeben");
    expect(messages).toContain("Bitte Strasse und Hausnummer angeben");
    expect(messages).toContain("Bitte 4-stellige PLZ angeben");
    expect(messages).toContain("Bitte Ort angeben");
  });

  it("answers French messages for a French label map", () => {
    const schema = createCheckoutSchema(fr);
    const empty = schema.safeParse(checkoutPayload());
    expect(!empty.success && firstMessage(empty as never)).toBe("Le panier est vide");
    const badCustomer = schema.safeParse({
      ...checkoutPayload(),
      lines: [{ sku: "A", qty: 1, expectedUnitPriceCents: 100 }],
    });
    const messages = badCustomer.success
      ? []
      : badCustomer.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Veuillez indiquer votre nom");
    expect(messages).toContain("Indiquez un NPA à 4 chiffres");
    expect(messages).not.toContain("Bitte Namen angeben");
  });

  it("interpolates the per-SKU cap into the localized max message", () => {
    const lines = Array.from({ length: MAX_QTY_PER_SKU + 1 }, () => ({
      sku: "A",
      qty: 1,
      expectedUnitPriceCents: 100,
    }));
    const deResult = createCheckoutSchema(de).safeParse({
      ...checkoutPayload(),
      lines,
      customer: { ...customer, name: "Anna", email: "a@b.ch", phone: "0791234567", street: "Str 1", postalCode: "8001", city: "ZRH" },
    });
    expect(!deResult.success).toBe(true);
    const messages = deResult.success ? [] : deResult.error.issues.map((i) => i.message);
    expect(messages).toContain(`Maximal ${MAX_QTY_PER_SKU} Stück pro Artikel.`);
    const frResult = createCheckoutSchema(fr).safeParse({
      ...checkoutPayload(),
      lines,
      customer: { ...customer, name: "Anna", email: "a@b.ch", phone: "0791234567", street: "Str 1", postalCode: "8001", city: "ZRH" },
    });
    const frMessages = frResult.success ? [] : frResult.error.issues.map((i) => i.message);
    expect(frMessages).toContain(`Maximum ${MAX_QTY_PER_SKU} pièces par article.`);
  });
});

describe("account schema messages follow the label map", () => {
  it("keeps the German bases byte-identical", () => {
    const register = createRegisterSchema(de).safeParse({
      name: "A",
      email: "x",
      password: "kurz",
      consent: false,
    });
    expect(!register.success).toBe(true);
    const messages = register.success ? [] : register.error.issues.map((i) => i.message);
    expect(messages).toContain("Bitte Namen angeben");
    expect(messages).toContain("Bitte gültige E-Mail angeben");
    expect(messages).toContain(
      "Das Passwort braucht mindestens 10 Zeichen, einen Buchstaben und eine Zahl.",
    );
    expect(messages).toContain("Bitte akzeptieren Sie die AGB, um fortzufahren.");
    expect(
      createCustomerLoginSchema(de).safeParse({ email: "x", password: "" }).error?.issues.map(
        (i) => i.message,
      ),
    ).toEqual(["Bitte eine gültige E-Mail eingeben.", "Bitte Passwort eingeben."]);
    expect(
      createAddressSchema(de).safeParse({
        label: "a",
        street: "a",
        postalCode: "1",
        city: "a",
        kind: "shipping",
      }).error?.issues.map((i) => i.message),
    ).toEqual([
      "Bitte Bezeichnung angeben (z. B. Zuhause)",
      "Bitte Strasse und Hausnummer angeben",
      "Bitte 4-stellige PLZ angeben",
      "Bitte Ort angeben",
    ]);
    expect(
      createAddressIdSchema(de).safeParse("nope").error?.issues[0]?.message,
    ).toBe("Ungültige Adresse.");
    expect(validateCustomerPassword("abc", de)).toBe(
      "Das Passwort braucht mindestens 10 Zeichen.",
    );
    expect(validateCustomerPassword("abcdefghij", de)).toBe(
      "Das Passwort braucht mindestens einen Buchstaben und eine Zahl.",
    );
    expect(validateCustomerPassword("abcdefghi1", de)).toBeNull();
  });

  it("answers French for a French label map", () => {
    const register = createRegisterSchema(fr).safeParse({
      name: "A",
      email: "x",
      password: "kurz",
      consent: false,
    });
    const messages = register.success ? [] : register.error.issues.map((i) => i.message);
    expect(messages).toContain("Veuillez indiquer votre nom");
    expect(messages).toContain(
      "Le mot de passe doit comporter au moins 10 caractères, une lettre et un chiffre.",
    );
    expect(messages).toContain("Veuillez accepter les CGV pour continuer.");
    expect(validateCustomerPassword("abc", fr)).toBe(
      "Le mot de passe doit comporter au moins 10 caractères.",
    );
  });
});
