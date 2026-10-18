import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { LABELS_DIR, getLabelFileCore, createLabelCore } from "@/server/shipping/label";
import { MockUpsProvider } from "@/server/shipping/mock";
import { transitionOrderCore } from "@/server/orders-admin";
import {
  updateImagesCore,
  updateProductCore,
  updateVariantCore,
} from "@/server/products-admin";
import { saveShopSettingsCore } from "@/server/shop-settings";
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
