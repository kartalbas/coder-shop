import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { PurchaseOrderModel } from "@/models/purchase-order";
import { SupplierModel } from "@/models/supplier";
import { UserModel } from "@/models/user";
import { createSessionToken } from "@/server/session-token";
import { hashPassword } from "@/server/password";
import {
  setCustomerBlockedCore,
  setCustomerNotesCore,
} from "@/server/customers-admin";
import { setReviewStatusCore } from "@/server/reviews";
import { createDiscountCore } from "@/server/discounts";
import { createDiscountAction } from "@/server/actions/admin/discounts";
import { replyToReviewAction } from "@/server/actions/admin/reviews";
import { LABELS_DIR, getLabelFileCore, createLabelCore } from "@/server/shipping/label";
import { MockUpsProvider } from "@/server/shipping/mock";
import { transitionOrderCore } from "@/server/orders-admin";
import {
  updateImagesCore,
  updateProductCore,
  updateVariantCore,
} from "@/server/products-admin";
import { saveShopSettingsCore } from "@/server/shop-settings";
import { formatChf } from "@/lib/format";
import {
  createPurchaseOrderCore,
  createSupplierCore,
  receivePurchaseOrderCore,
} from "@/server/purchasing";
import { handoverPickupCore, markPickupReadyCore } from "@/server/pickup";
import { recordInvoicePaymentCore, setCreditLimitCore } from "@/server/invoices";
import { saveCatalogTypeCore } from "@/server/catalog-types";
import {
  invalidateI18nCache,
  saveLanguageCore,
  saveTranslationCore,
} from "@/server/i18n";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/shop-settings";
import type { CatalogTypeConfig } from "@/lib/catalog-types";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

// Issue #58 step 2 (admin orders slice) and step 3 (products, settings, catalog types,
// translations): the admin cores answer their refusals from the translation table in
// the request language — the same discipline as tests/core-error-messages.test.ts. The
// mock plays the request scope (lang cookie); without it the first active language
// (German) answers, which is what the German specs and scripts rely on. Every French
// assertion here fails on the pre-change build, where these texts were hard-coded
// German literals.

const request = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  // #58 step 5: the discount/reply schemas live in server actions behind the admin
  // session — a valid admin token plays the session cookie for those two tests.
  session: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "lang") return request.cookie ? { value: request.cookie } : undefined;
      if (name === "admin_session") {
        return request.session ? { value: request.session } : undefined;
      }
      return undefined;
    },
  }),
  headers: async () => ({ get: () => null }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

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
  request.session = undefined;
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

  // #58 review nit (14:13): the storage refusal — the label PDF cannot be written —
  // answers in the request language and the order stays packed.
  it("an unwritable label directory is refused in French and keeps the order packed", async () => {
    const created = await OrderModel.create(orderFixture("B-ADM-CORE-3", "packed"));
    const dir = path.resolve(LABELS_DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.chmod(dir, 0o500);
    try {
      request.cookie = "fr";
      const result = await createLabelCore(created._id.toString(), new MockUpsProvider());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("storage_error");
      expect(result.error).toBe(
        "L'étiquette n'a pas pu être enregistrée. La commande reste « emballée » — veuillez réessayer.",
      );
    } finally {
      await fs.chmod(dir, 0o755);
    }
    const stillPacked = await OrderModel.findById(created._id).lean().exec();
    expect(stillPacked?.status).toBe("packed");
  });
});

// #58 review nit (14:13): losing the conditional write is the conflict refusal.
describe("transitionOrderCore conflict follows the request language", () => {
  it("a lost conditional write is refused in French and in the German base", async () => {
    const created = await OrderModel.create(orderFixture("B-ADM-CORE-4", "paid"));
    const spy = vi.spyOn(OrderModel, "updateOne").mockResolvedValue({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    });
    try {
      request.cookie = "fr";
      const french = await transitionOrderCore(created._id.toString(), "picking");
      expect(french.ok).toBe(false);
      if (french.ok) return;
      expect(french.error).toBe(
        "La commande a été modifiée entre-temps. Veuillez réessayer.",
      );

      request.cookie = undefined;
      const german = await transitionOrderCore(created._id.toString(), "picking");
      expect(german.ok).toBe(false);
      if (german.ok) return;
      expect(german.error).toBe(
        "Die Bestellung wurde zwischenzeitlich geändert. Bitte erneut versuchen.",
      );
    } finally {
      spy.mockRestore();
    }
  });
});

async function seedShoe(slug: string) {
  return ProductModel.create({
    slug,
    name: `Core Test ${slug}`,
    description: "Schuh für Admin-Kern-Tests.",
    type: "shoes",
    brand: "Nike",
    priceCents: 15000,
    images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { color: ["schwarz"], size: ["42"] },
    variants: [
      {
        sku: `CORE-${slug}`,
        label: "42 / schwarz",
        priceDeltaCents: 0,
        stock: 5,
        restockThreshold: 3,
        weightGrams: 400,
        attributes: { color: "schwarz", size: 42 },
      },
    ],
  });
}

describe("product core refusals follow the request language", () => {
  it("an unknown product is refused in French by all three update cores", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    request.cookie = "fr";

    const core = await updateProductCore(missingId, {
      name: "Testprodukt",
      description: "Ein Produkt für die Kern-Tests.",
      brand: "Nike",
      priceCents: 10000,
    });
    expect(core.ok).toBe(false);
    if (core.ok) return;
    expect(core.error).toBe("Produit introuvable.");

    const variant = await updateVariantCore(missingId, "CORE-x", {
      priceDeltaCents: 0,
      stock: 5,
      expectedStock: 5,
      weightGrams: 400,
      attributes: { color: "schwarz", size: 42 },
    });
    expect(variant.ok).toBe(false);
    if (variant.ok) return;
    expect(variant.error).toBe("Produit introuvable.");

    const images = await updateImagesCore(missingId, {
      images: [{ src: "/products/core-1.webp", alt: "Testbild" }],
    });
    expect(images.ok).toBe(false);
    if (images.ok) return;
    expect(images.error).toBe("Produit introuvable.");
  });

  it("a stale stock edit is refused in French with the sku, German base alongside", async () => {
    const product = await seedShoe("stale");
    const input = {
      priceDeltaCents: 0,
      stock: 7,
      expectedStock: 4,
      weightGrams: 400,
      attributes: { color: "schwarz", size: 42 },
    };

    request.cookie = "fr";
    const french = await updateVariantCore(product._id.toString(), "CORE-stale", input);
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe(
      "Le stock de CORE-stale a changé depuis le chargement. Veuillez recharger la page et enregistrer à nouveau.",
    );

    request.cookie = undefined;
    const german = await updateVariantCore(product._id.toString(), "CORE-stale", input);
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe(
      "Der Lagerbestand von CORE-stale hat sich seit dem Laden geändert. Bitte Seite neu laden und erneut speichern.",
    );
  });
});

describe("settings, catalog type, translation and language refusals follow the request language", () => {
  it("deactivating the last shipping or payment method is refused in French", async () => {
    const noShipping = structuredClone(DEFAULT_SHOP_SETTINGS);
    for (const method of noShipping.shippingMethods) method.active = false;
    const noPayment = structuredClone(DEFAULT_SHOP_SETTINGS);
    for (const method of noPayment.paymentMethods) method.active = false;

    request.cookie = "fr";
    const shipping = await saveShopSettingsCore(noShipping);
    expect(shipping.ok).toBe(false);
    if (shipping.ok) return;
    expect(shipping.error).toBe("Au moins un mode de livraison actif est nécessaire.");

    const payment = await saveShopSettingsCore(noPayment);
    expect(payment.ok).toBe(false);
    if (payment.ok) return;
    expect(payment.error).toBe("Au moins un mode de paiement actif est nécessaire.");

    request.cookie = undefined;
    const german = await saveShopSettingsCore(noShipping);
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Mindestens eine aktive Versandart ist nötig.");
  });

  it("a bad catalog type key and a dimensionless type are refused in French", async () => {
    const base: CatalogTypeConfig = {
      key: "core-test",
      label: "Kern-Test",
      position: 9,
      dimensions: [{ key: "color", label: "Farbe", facet: true, order: "alpha" }],
      stockTracking: "quantity",
      comparable: false,
      photoNoun: "test object",
      brands: [],
    };

    request.cookie = "fr";
    const badKey = await saveCatalogTypeCore({ ...base, key: "Ungültig!" });
    expect(badKey.ok).toBe(false);
    if (badKey.ok) return;
    expect(badKey.error).toBe("Clé du type : minuscules, chiffres et tirets.");

    const noDimensions = await saveCatalogTypeCore({ ...base, dimensions: [] });
    expect(noDimensions.ok).toBe(false);
    if (noDimensions.ok) return;
    expect(noDimensions.error).toBe("Au moins une dimension de variante est nécessaire.");
  });

  it("a translation without German base and a language with a bad code are refused in French", async () => {
    request.cookie = "fr";
    const translation = await saveTranslationCore({
      key: "shop.core.test",
      area: "shop",
      de: "  ",
      texts: {},
    });
    expect(translation.ok).toBe(false);
    if (translation.ok) return;
    expect(translation.error).toBe("Texte de base allemand manquant.");

    const language = await saveLanguageCore({
      code: "EN",
      label: "English",
      intlLocale: "en-GB",
      position: 9,
      active: true,
    });
    expect(language.ok).toBe(false);
    if (language.ok) return;
    expect(language.error).toBe("Code langue : 2–3 minuscules.");

    request.cookie = undefined;
    const german = await saveTranslationCore({
      key: "shop.core.test",
      area: "shop",
      de: "",
      texts: {},
    });
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Deutscher Basistext fehlt.");
  });
});

// ---------- #58 step 4: purchasing, pickup and invoice cores ----------

async function seedSupplier(name: string) {
  return SupplierModel.create({ name, email: `${name.toLowerCase()}@example.ch`, leadTimeDays: 7, active: true });
}

describe("purchasing core refusals follow the request language", () => {
  it("a duplicate supplier name is refused in French and in the German base", async () => {
    await seedSupplier("Doppelt AG");
    const input = { name: "Doppelt AG", email: "neu@example.ch", leadTimeDays: 5, active: true };

    request.cookie = "fr";
    const french = await createSupplierCore(input);
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Un fournisseur portant ce nom existe déjà.");

    request.cookie = undefined;
    const german = await createSupplierCore(input);
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Ein Lieferant mit diesem Namen existiert bereits.");
  });

  it("an unknown SKU is refused in French with the sku named", async () => {
    const supplier = await seedSupplier("Einmal AG");
    request.cookie = "fr";
    const result = await createPurchaseOrderCore({
      supplierId: supplier._id.toString(),
      lines: [{ sku: "GIBTS-NICHT", qty: 1, unitPriceCents: 100 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("SKU inconnue : GIBTS-NICHT");
  });

  it("a goods receipt from a draft is refused in French", async () => {
    const supplier = await seedSupplier("Entwurf AG");
    const product = await seedShoe("empfang");
    const po = await PurchaseOrderModel.create({
      poNumber: "E-ADM-CORE-1",
      supplierId: supplier._id,
      status: "draft",
      lines: [
        {
          productId: product._id,
          sku: "CORE-empfang",
          qty: 2,
          unitPriceCents: 500,
          received: 0,
        },
      ],
      totalCents: 1000,
    });

    request.cookie = "fr";
    const result = await receivePurchaseOrderCore(po._id.toString(), { "CORE-empfang": 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(
      "La réception n'est possible que pour les commandes passées.",
    );
  });

  it("a serial line without serials is refused in French with the counts", async () => {
    const supplier = await seedSupplier("Serien AG");
    const product = await ProductModel.create({
      slug: "core-serial",
      name: "Core Serial Phone",
      description: "Smartphone für Admin-Kern-Tests.",
      type: "smartphone",
      brand: "Apple",
      priceCents: 100000,
      images: [{ src: "/products/core-serial-1.webp", alt: "Test" }],
      featured: false,
      filter: { color: ["schwarz"], storage: ["128 GB"] },
      variants: [
        {
          sku: "CORE-serial",
          label: "128 GB / schwarz",
          priceDeltaCents: 0,
          stock: 0,
          restockThreshold: 2,
          weightGrams: 200,
          attributes: { color: "schwarz", storage: "128 GB" },
        },
      ],
    });
    const po = await PurchaseOrderModel.create({
      poNumber: "E-ADM-CORE-2",
      supplierId: supplier._id,
      status: "ordered",
      lines: [
        { productId: product._id, sku: "CORE-serial", qty: 2, unitPriceCents: 50000, received: 0 },
      ],
      totalCents: 100000,
    });

    request.cookie = "fr";
    const result = await receivePurchaseOrderCore(po._id.toString(), { "CORE-serial": 2 }, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(
      "Pour CORE-serial, 2 numéro(s) de série sont requis — reçus : 0.",
    );
  });
});

function pickupFixture(orderNumber: string, status: "ready" | "paid") {
  const now = new Date();
  return {
    orderNumber,
    status,
    statusLog: [{ status: "new" as const, at: now }, { status, at: now }],
    customer: {
      name: "Ben Test",
      email: `pickup-core-${orderNumber}@example.ch`,
      phone: "079 111 22 33",
      street: "Testweg 2",
      postalCode: "8000",
      city: "Zürich",
      country: "CH",
    },
    lines: [],
    totals: { subtotalCents: 2000, shippingCents: 0, totalCents: 2000, vatCents: 150 },
    shipping: {
      method: "pickup",
      storePickup: true,
      pickup: { code: "CODE42" },
    },
    payment: { method: "mock", kind: "on_pickup" as const, reference: `P-${orderNumber}` },
    createdAt: now,
    updatedAt: now,
  };
}

describe("pickup core refusals follow the request language", () => {
  it("a wrong handover code is refused in French and in the German base", async () => {
    const created = await OrderModel.create(pickupFixture("B-ADM-CORE-5", "ready"));

    request.cookie = "fr";
    const french = await handoverPickupCore(created._id.toString(), "FALSCH", "cash", "admin@example.ch");
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Le code de retrait ne correspond pas.");

    request.cookie = undefined;
    const german = await handoverPickupCore(created._id.toString(), "FALSCH", "cash", "admin@example.ch");
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Der Abholcode stimmt nicht überein.");
  });

  it("marking a parcel order ready is refused in French as not found", async () => {
    const created = await OrderModel.create(orderFixture("B-ADM-CORE-6", "paid"));
    request.cookie = "fr";
    const result = await markPickupReadyCore(created._id.toString(), "admin@example.ch");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Commande introuvable.");
  });
});

describe("invoice core refusals follow the request language", () => {
  function invoiceFixture(orderNumber: string) {
    const now = new Date();
    return {
      orderNumber,
      status: "new" as const,
      statusLog: [{ status: "new" as const, at: now }],
      customer: {
        name: "Eva Test",
        email: `invoice-core-${orderNumber}@example.ch`,
        phone: "079 111 22 33",
        street: "Testweg 3",
        postalCode: "8000",
        city: "Zürich",
        country: "CH",
      },
      lines: [],
      totals: { subtotalCents: 1000, shippingCents: 0, totalCents: 1000, vatCents: 75 },
      shipping: { method: "standard" },
      payment: {
        method: "invoice",
        kind: "invoice" as const,
        reference: `P-${orderNumber}`,
        invoice: { dueAt: now, paidCents: 0, qrReference: "RF1234567890123456789012345603" },
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  it("an amount over the open balance is refused in French with the amount", async () => {
    const created = await OrderModel.create(invoiceFixture("B-ADM-CORE-7"));
    request.cookie = "fr";
    const result = await recordInvoicePaymentCore(created._id.toString(), 2000, "admin@example.ch");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The amount interpolates the already-formatted value (NBSP included) — the base
    // formatter, as the admin formats are still base-locale (#58 record).
    expect(result.error).toBe(
      `Le montant dépasse le montant ouvert de ${formatChf(1000)}.`,
    );
  });

  it("a junk credit limit and an unknown customer are refused in their request language", async () => {
    request.cookie = "fr";
    const french = await setCreditLimitCore(new mongoose.Types.ObjectId().toString(), 1.5);
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Montant invalide.");

    const user = await UserModel.create({
      email: "credit-core@example.ch",
      name: "Credit Core",
      role: "customer",
      passwordHash: "x",
    });
    request.cookie = undefined;
    const german = await setCreditLimitCore(user._id.toString(), -5);
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Ungültiger Betrag.");

    request.cookie = "fr";
    const missing = await setCreditLimitCore(new mongoose.Types.ObjectId().toString(), 100);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toBe("Client introuvable.");
  });
});

// ---------- #58 step 5: customers, reviews and discounts cores ----------

describe("customer core refusals follow the request language", () => {
  it("an unknown customer id is refused in French and in the German base", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();

    request.cookie = "fr";
    const french = await setCustomerBlockedCore(missingId, true);
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Compte introuvable.");

    request.cookie = undefined;
    const german = await setCustomerBlockedCore(missingId, true);
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Konto nicht gefunden.");
  });

  it("an over-long note is refused in French with the max, German base alongside", async () => {
    const user = await UserModel.create({
      email: "note-core@example.ch",
      name: "Note Core",
      role: "customer",
      passwordHash: "x",
    });
    const notes = "x".repeat(2001);

    request.cookie = "fr";
    const french = await setCustomerNotesCore(user._id.toString(), notes);
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("La note est trop longue (max. 2000 caractères).");

    request.cookie = undefined;
    const german = await setCustomerNotesCore(user._id.toString(), notes);
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Notiz ist zu lang (max. 2000 Zeichen).");
  });
});

describe("review moderation refusals follow the request language", () => {
  it("an unknown review id is refused in French and in the German base", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();

    request.cookie = "fr";
    const french = await setReviewStatusCore(missingId, "approved");
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Avis introuvable.");

    request.cookie = undefined;
    const german = await setReviewStatusCore(missingId, "approved");
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Bewertung nicht gefunden.");
  });
});

describe("discount core refusals follow the request language", () => {
  const base = {
    kind: "percent" as const,
    percent: 10,
    minOrderCents: 0,
    perCustomerOnce: false,
  };

  it("a bad code shape is refused in French and in the German base", async () => {
    request.cookie = "fr";
    const french = await createDiscountCore({ ...base, code: "a!" });
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Code : 3–32 caractères parmi lettres, chiffres et « - ».");

    request.cookie = undefined;
    const german = await createDiscountCore({ ...base, code: "a!" });
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Code: 3–32 Zeichen aus Buchstaben, Zahlen und «-».");
  });

  it("a duplicate code is refused in French with the German base alongside", async () => {
    await createDiscountCore({ ...base, code: "DUPQUE" });

    request.cookie = "fr";
    const french = await createDiscountCore({ ...base, code: "DUPQUE" });
    expect(french.ok).toBe(false);
    if (french.ok) return;
    expect(french.error).toBe("Ce code existe déjà.");

    request.cookie = undefined;
    const german = await createDiscountCore({ ...base, code: "DUPQUE" });
    expect(german.ok).toBe(false);
    if (german.ok) return;
    expect(german.error).toBe("Diesen Code gibt es schon.");
  });

  it("a reversed validity window is refused in French", async () => {
    request.cookie = "fr";
    const result = await createDiscountCore({
      ...base,
      code: "DATEREV",
      validFrom: new Date("2026-06-01"),
      validTo: new Date("2026-05-01"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("La date de début doit précéder la date de fin.");
  });
});

describe("discount and review action schemas follow the request language", () => {
  let adminToken = "";

  beforeAll(async () => {
    const admin = await UserModel.create({
      email: "admin-step5@example.ch",
      name: "Step Five Admin",
      passwordHash: await hashPassword("StepFive!2026"),
      role: "admin",
    });
    adminToken = createSessionToken(admin._id.toString());
  });

  // The file-wide afterEach clears the request scope — the session is replayed here.
  beforeEach(() => {
    request.session = adminToken;
  });

  it("an invalid CHF amount is refused in French and in the German base", async () => {
    const form = (amount: string) => {
      const data = new FormData();
      data.set("code", "CHFTEST");
      data.set("kind", "fixed");
      data.set("amountCents", amount);
      return data;
    };

    request.cookie = "fr";
    const french = await createDiscountAction(null, form("viel"));
    expect(french.error).toBe("Veuillez indiquer un montant valide.");

    request.cookie = undefined;
    const german = await createDiscountAction(null, form("viel"));
    expect(german.error).toBe("Bitte einen gültigen Betrag angeben.");
  });

  it("a too-short review reply is refused in French and in the German base", async () => {
    const form = (text: string) => {
      const data = new FormData();
      data.set("reviewId", new mongoose.Types.ObjectId().toString());
      data.set("text", text);
      return data;
    };

    request.cookie = "fr";
    const french = await replyToReviewAction(null, form("ok"));
    expect(french.error).toBe("Veuillez écrire une réponse.");

    request.cookie = undefined;
    const german = await replyToReviewAction(null, form("ok"));
    expect(german.error).toBe("Bitte eine Antwort schreiben.");
  });
});
