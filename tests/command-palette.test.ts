import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { SupplierModel } from "@/models/supplier";
import { UserModel } from "@/models/user";
import { commandSearchCore } from "@/server/command-palette";
import { hashPassword } from "@/server/password";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

async function seedProduct(slug: string, name: string, sku: string, brand = "Testmarke") {
  await ProductModel.create({
    slug,
    name,
    description: "Produkt für Palette-Tests.",
    type: "smartphone",
    brand,
    priceCents: 10_000,
    images: [{ src: `/products/${slug}-1.webp`, alt: "Test" }],
    featured: false,
    filter: { colors: ["schwarz"], sizes: [], storage: [128], materials: [] },
    variants: [
      {
        sku,
        label: "128 GB",
        priceDeltaCents: 0,
        stock: 10,
        restockThreshold: 3,
        weightGrams: 200,
        attributes: { color: "schwarz", storage: 128 },
      },
    ],
  });
}

describe("admin command palette search (issue #49)", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await OrderModel.create({
      orderNumber: "B-2026-000042",
      status: "paid",
      statusLog: [{ status: "paid", at: new Date() }],
      customer: {
        name: "Nina Nakamoto",
        email: "nina@example.com",
        phone: "079 000 00 00",
        street: "Weg 1",
        postalCode: "8001",
        city: "Zürich",
        country: "CH",
      },
      lines: [
        {
          productId: "000000000000000000000000",
          sku: "TST-1",
          name: "Palette Test",
          variantLabel: "128 GB",
          qty: 1,
          unitPriceCents: 10_000,
          totalCents: 10_000,
          weightGrams: 200,
        },
      ],
      totals: { subtotalCents: 10_000, shippingCents: 0, totalCents: 10_000, vatCents: 0 },
      shipping: { method: "standard" },
      payment: { method: "mock", reference: "P-1", paidAt: new Date() },
    });
    await seedProduct("apfel-iphone-16", "Apfel iPhone 16", "APL-IP16-256", "Apfel");
    await UserModel.create({
      email: "kurt@example.com",
      name: "Kurt Kunde",
      passwordHash: await hashPassword("EinStarkesPasswort1"),
      role: "customer",
      addresses: [],
    });
    await UserModel.create({
      email: "admin@example.com",
      name: "Ada Admin",
      passwordHash: await hashPassword("EinStarkesPasswort1"),
      role: "admin",
      addresses: [],
    });
    await SupplierModel.create({ name: "Mustergrosshandel", email: "einkauf@mg.example", leadTimeDays: 5 });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("finds an order by its number", async () => {
    const hits = await commandSearchCore("B-2026-000042");
    const order = hits.find((hit) => hit.group === "Bestellungen");
    expect(order).toBeDefined();
    expect(order!.primary).toBe("B-2026-000042");
    expect(order!.href).toMatch(/^\/admin\/orders\/[0-9a-f]{24}$/);
  });

  it("finds orders by customer name and e-mail", async () => {
    expect((await commandSearchCore("nakamoto")).some((h) => h.group === "Bestellungen")).toBe(true);
    expect((await commandSearchCore("nina@example")).some((h) => h.group === "Bestellungen")).toBe(true);
  });

  it("finds products by name, brand and SKU", async () => {
    for (const query of ["iphone", "apfel", "APL-IP16"]) {
      const hit = (await commandSearchCore(query)).find((h) => h.group === "Produkte");
      expect(hit?.primary, query).toBe("Apfel iPhone 16");
      expect(hit?.href).toMatch(/^\/admin\/products\/[0-9a-f]{24}$/);
    }
  });

  it("finds customers but never admin accounts", async () => {
    const hits = await commandSearchCore("kurt");
    expect(hits.some((h) => h.group === "Kunden" && h.primary === "Kurt Kunde")).toBe(true);
    expect((await commandSearchCore("ada")).some((h) => h.group === "Kunden")).toBe(false);
  });

  it("finds suppliers and links to their edit form", async () => {
    const hit = (await commandSearchCore("muster")).find((h) => h.group === "Lieferanten");
    expect(hit?.primary).toBe("Mustergrosshandel");
    expect(hit?.href).toMatch(/^\/admin\/suppliers\?edit=[0-9a-f]{24}$/);
  });

  it("empty query finds nothing and each group is capped", async () => {
    expect(await commandSearchCore("   ")).toEqual([]);
    for (let i = 0; i < 8; i += 1) {
      await seedProduct(`limit-produkt-${i}`, `Limit Produkt ${i}`, `LIM-${i}`);
    }
    const productHits = (await commandSearchCore("Limit Produkt")).filter(
      (hit) => hit.group === "Produkte",
    );
    expect(productHits.length).toBeGreaterThan(0);
    expect(productHits.length).toBeLessThanOrEqual(5);
  });
});
