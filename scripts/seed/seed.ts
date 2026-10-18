import "../load-env"; // issue #38: ADMIN_PASSWORD & friends from .env.local
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { swissYear } from "@/lib/dates";
import { formatOrderNumber, formatPaymentReference, formatPoNumber } from "@/lib/numbers";
import { HAPPY_PATH } from "@/lib/orders/state-machine";
import { computeTotals } from "@/lib/pricing";
import { parcelWeightGrams } from "@/lib/shipping/weight";
import { DEFAULT_CATALOG_TYPES, type CatalogTypeConfig } from "@/lib/catalog-types";
import { DEFAULT_LANGUAGES, DEFAULT_TRANSLATIONS } from "@/lib/i18n";
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from "@/lib/shop-settings";
import { LanguageModel } from "@/models/language";
import { TranslationModel } from "@/models/translation";
import { deriveFilter } from "@/lib/facets";
import { CounterModel } from "@/models/counter";
import { OrderModel, type OrderStatus, type StatusLogEntry } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { ProductTypeConfigModel, toCatalogTypeConfig } from "@/models/product-type-config";
import { PurchaseOrderModel } from "@/models/purchase-order";
import { ShopSettingsModel, toShopSettings } from "@/models/shop-settings";
import { StockUnitModel } from "@/models/stock-unit";
import { SupplierModel } from "@/models/supplier";
import { UserModel } from "@/models/user";
import { connectDB, dbMode, disconnectDB, isDbPathLocked } from "@/server/db";
import { env } from "@/server/env";
import { hashPassword } from "@/server/password";
import { mockTrackingNumber } from "@/server/shipping/mock";
import { generateCatalog, mulberry32 } from "./catalog";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@codershop.ch";

// The admin password is not a source-code constant: `ADMIN_PASSWORD` env wins, otherwise a
// random one is generated and printed exactly once. A re-seed never touches the password of
// an existing admin user.
function adminPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv) return { password: fromEnv, generated: false };
  return { password: randomBytes(12).toString("base64url"), generated: true };
}

const SUPPLIERS = [
  { name: "TechDirect GmbH", email: "orders@techdirect.ch", phone: "+41 44 555 01 01", leadTimeDays: 7 },
  { name: "ShoeSource AG", email: "sales@shoesource.ch", phone: "+41 61 555 02 02", leadTimeDays: 14 },
  { name: "TextilWelt", email: "kontakt@textilwelt.ch", leadTimeDays: 10 },
];

const CUSTOMERS = [
  ["Lena Meier", "lena.meier@example.ch", "079 555 01 10", "Bahnhofstrasse 12", "8001", "Zürich"],
  ["Luca Bianchi", "luca.bianchi@example.ch", "078 555 02 20", "Seestrasse 3", "3005", "Bern"],
  ["Anna Schmid", "anna.schmid@example.ch", "076 555 03 30", "Hauptstrasse 45", "4051", "Basel"],
  ["Marco Keller", "marco.keller@example.ch", "079 555 04 40", "Dorfweg 8", "1003", "Lausanne"],
  ["Sara Widmer", "sara.widmer@example.ch", "077 555 05 50", "Mühleweg 21", "8400", "Winterthur"],
  ["Noah Frei", "noah.frei@example.ch", "076 555 06 60", "Kirchgasse 7", "9000", "St. Gallen"],
] as const;

const STATUS_PLAN: OrderStatus[] = [
  "new",
  "new",
  "paid",
  "paid",
  "paid",
  "picking",
  "picking",
  "packed",
  "packed",
  "shipped",
  "shipped",
  "delivered",
  "delivered",
  "delivered",
  "cancelled",
];

// Issue #61: the catalog type configuration is seeded from `DEFAULT_CATALOG_TYPES`,
// insert-only (#14 rule) — an edited configuration survives a re-seed. Returns the
// stored configs (#64): once the admin editor can change dimensions, everything the
// seed derives from them (filter repair) must use the stored rows, not the defaults.
export async function seedCatalogTypes(): Promise<CatalogTypeConfig[]> {
  for (const config of DEFAULT_CATALOG_TYPES) {
    await ProductTypeConfigModel.updateOne(
      { key: config.key },
      { $setOnInsert: { ...config } },
      { upsert: true },
    );
  }
  const stored = await ProductTypeConfigModel.find().sort({ position: 1 }).lean().exec();
  return stored.map((doc) => toCatalogTypeConfig(doc));
}

// Issue #64: the commerce rules (VAT, shipping, payment) are configuration too —
// insert-only like everything else (#14), so admin edits survive a re-seed. Returns the
// stored document so seeded orders compute totals with the rules the shop actually uses.
export async function seedShopSettings(): Promise<ShopSettings> {
  await ShopSettingsModel.updateOne(
    { key: "shop" },
    { $setOnInsert: { key: "shop", ...DEFAULT_SHOP_SETTINGS } },
    { upsert: true },
  );
  const doc = await ShopSettingsModel.findOne({ key: "shop" }).lean().exec();
  return doc ? toShopSettings(doc) : structuredClone(DEFAULT_SHOP_SETTINGS);
}

// Issue #58: the shop's languages and the single translation table are configuration
// rows, seeded insert-only (#14) so admin edits and added languages survive a re-seed.
export async function seedLanguages(): Promise<void> {
  for (const language of DEFAULT_LANGUAGES) {
    await LanguageModel.updateOne(
      { code: language.code },
      { $setOnInsert: { ...language } },
      { upsert: true },
    );
  }
}

export async function seedTranslations(): Promise<void> {
  for (const entry of DEFAULT_TRANSLATIONS) {
    await TranslationModel.updateOne(
      { key: entry.key },
      { $setOnInsert: { ...entry } },
      { upsert: true },
    );
  }
}

// The denormalized `filter` block is derived data (ARCHITECTURE §3): recompute it from
// the variants and the current type configuration — this repairs documents written
// before the dynamic facet keys (issue #61) and stays idempotent.
export async function repairProductFilters(types: CatalogTypeConfig[]): Promise<number> {
  let repaired = 0;
  for (const product of await ProductModel.find().lean().exec()) {
    const dimensions = types.find((type) => type.key === product.type)?.dimensions ?? [];
    const expected = deriveFilter(product.variants, dimensions);
    const stored = (product.filter ?? {}) as Record<string, string[]>;
    const same =
      Object.keys(expected).length === Object.keys(stored).length &&
      Object.entries(expected).every(
        ([key, values]) =>
          Array.isArray(stored[key]) &&
          stored[key].length === values.length &&
          stored[key].every((value, index) => value === values[index]),
      );
    if (!same) {
      await ProductModel.updateOne({ _id: product._id }, { $set: { filter: expected } });
      repaired += 1;
    }
  }
  return repaired;
}

// Re-running the seed never touches existing shop data (issue #14): every field is
// `$setOnInsert`, so an admin edit or a sold-out stock value survives; only products that
// do not exist yet are created. Use `npm run seed -- --fresh` for a real reset.
export async function seedProducts(): Promise<number> {
  const catalog = generateCatalog();
  // Image slots are recorded with their final photo paths (public/products/<slug>-<n>.webp,
  // gitignored); `npm run images` fills them. The seed writes no image files (issue #29).
  for (const product of catalog) {
    const { images, ...rest } = product;
    await ProductModel.updateOne(
      { slug: product.slug },
      { $setOnInsert: { ...rest, images } },
      { upsert: true },
    );
  }
  return catalog.length;
}

export async function seedUser(): Promise<{ created: boolean; generatedPassword?: string }> {
  const { password, generated } = adminPassword();
  const passwordHash = await hashPassword(password);
  const result = await UserModel.updateOne(
    { email: ADMIN_EMAIL },
    {
      $setOnInsert: { name: "Shop Admin", role: "admin", passwordHash },
    },
    { upsert: true },
  );
  const created = result.upsertedCount > 0;
  return { created, ...(created && generated ? { generatedPassword: password } : {}) };
}

async function seedSuppliers() {
  const byName = new Map<string, mongoose.Types.ObjectId>();
  for (const supplier of SUPPLIERS) {
    const doc = await SupplierModel.findOneAndUpdate(
      { name: supplier.name },
      { $setOnInsert: supplier },
      { upsert: true, returnDocument: "after" },
    );
    byName.set(supplier.name, doc._id);
  }
  return byName;
}

async function seedOrders(rng: () => number, now: Date, settings: ShopSettings): Promise<void> {
  if ((await OrderModel.countDocuments()) > 0) {
    console.log("orders collection not empty — skipping sample orders (idempotent)");
    return;
  }
  // Issue #64: the sample orders use the configured parcel methods (never pickup — the
  // happy-path chain below is the parcel chain) and the first immediate payment method.
  const parcelMethods = settings.shippingMethods.filter((method) => method.active && !method.storePickup);
  const immediatePayment =
    settings.paymentMethods.find((method) => method.active && method.kind === "immediate") ??
    settings.paymentMethods[0];
  const products = await ProductModel.find().sort({ slug: 1 }).lean();
  const year = swissYear(now);
  const orders = [];
  for (let i = 0; i < STATUS_PLAN.length; i++) {
    const status = STATUS_PLAN[i];
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const lineCount = 1 + Math.floor(rng() * 3);
    const lines = [];
    for (let l = 0; l < lineCount; l++) {
      const product = products[Math.floor(rng() * products.length)];
      const variant = product.variants[Math.floor(rng() * product.variants.length)];
      const qty = 1 + Math.floor(rng() * 2);
      const unitPriceCents = product.priceCents + variant.priceDeltaCents;
      lines.push({
        productId: product._id,
        sku: variant.sku,
        name: product.name,
        variantLabel: variant.label,
        qty,
        unitPriceCents,
        totalCents: unitPriceCents * qty,
        weightGrams: variant.weightGrams,
      });
    }
    const method = parcelMethods[rng() < 0.75 ? 0 : Math.min(1, parcelMethods.length - 1)]!;
    const totals = computeTotals(lines, method.key, settings);
    const createdAt = new Date(now.getTime() - Math.floor(rng() * 14 * DAY_MS) - i * HOUR_MS);
    const chainUpTo = status === "cancelled" ? 1 : HAPPY_PATH.indexOf(status);
    const statusLog: StatusLogEntry[] = HAPPY_PATH.slice(0, chainUpTo + 1).map((s, step) => ({
      status: s,
      at: new Date(createdAt.getTime() + step * 2 * HOUR_MS),
    }));
    if (status === "cancelled") {
      statusLog.push({
        status: "cancelled",
        at: new Date(createdAt.getTime() + 3 * HOUR_MS),
        note: "Storniert, Lager gutgeschrieben",
        by: "admin@codershop.ch",
      });
    }
    const shipped = status === "shipped" || status === "delivered";
    orders.push({
      orderNumber: formatOrderNumber(year, i + 1),
      status,
      statusLog,
      customer: {
        name: customer[0],
        email: customer[1],
        phone: customer[2],
        street: customer[3],
        postalCode: customer[4],
        city: customer[5],
        country: "CH",
      },
      lines,
      totals,
      shipping: {
        method: method.key,
        storePickup: method.storePickup,
        ...(shipped
          ? {
              carrier: "ups" as const,
              trackingNumber: mockTrackingNumber(rng),
              parcelWeightGrams: parcelWeightGrams(lines),
            }
          : {}),
      },
      payment: {
        method: immediatePayment.key,
        kind: immediatePayment.kind,
        reference: formatPaymentReference(i + 1),
        ...(status !== "new"
          ? { paidAt: new Date(createdAt.getTime() + 2 * HOUR_MS) }
          : {}),
      },
      createdAt,
      updatedAt: statusLog[statusLog.length - 1].at,
    });
  }
  await OrderModel.insertMany(orders);
  await CounterModel.updateOne(
    { _id: "order" },
    { $set: { seq: orders.length } },
    { upsert: true },
  );
}

async function seedPurchaseOrders(
  rng: () => number,
  suppliers: Map<string, mongoose.Types.ObjectId>,
  now: Date,
  types: CatalogTypeConfig[],
): Promise<void> {
  if ((await PurchaseOrderModel.countDocuments()) > 0) {
    console.log("purchase_orders collection not empty — skipping sample POs (idempotent)");
    return;
  }
  const products = await ProductModel.find().sort({ slug: 1 }).lean();
  const statuses = ["draft", "ordered", "received"] as const;
  const supplierNames = [...suppliers.keys()];
  const year = swissYear(now);
  // Issue #62 review: the ordered sample PO carries one serial-tracked line (per the
  // type configs' stockTracking) so goods receipt by serial is demonstrable end to end.
  const serialTypes = new Set(
    types.filter((type) => type.stockTracking === "serial").map((type) => type.key),
  );
  const serialProduct = products.find((product) => serialTypes.has(product.type));
  const pos = [];
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const lines = [];
    for (let l = 0; l < 2; l++) {
      const product =
        status === "ordered" && l === 0 && serialProduct
          ? serialProduct
          : products[(i * 7 + l * 13) % products.length];
      const variant = product.variants[0];
      const qty = 10 + Math.floor(rng() * 20);
      lines.push({
        productId: product._id,
        sku: variant.sku,
        qty,
        unitPriceCents: Math.round(product.priceCents * 0.6),
        received: status === "received" ? qty : 0,
      });
    }
    const createdAt = new Date(now.getTime() - (i + 2) * DAY_MS);
    pos.push({
      poNumber: formatPoNumber(year, i + 1),
      supplierId: suppliers.get(supplierNames[i]) ?? [...suppliers.values()][0],
      status,
      lines,
      totalCents: lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0),
      ...(status !== "draft" ? { orderedAt: new Date(createdAt.getTime() + DAY_MS) } : {}),
      // Issue #62 (#55): an ordered PO shows its expected arrival (lead time from the
      // supplier, here the seed's fixed 5 days).
      ...(status === "ordered"
        ? { expectedArrivalAt: new Date(createdAt.getTime() + 6 * DAY_MS) }
        : {}),
      ...(status === "received" ? { receivedAt: new Date(createdAt.getTime() + 4 * DAY_MS) } : {}),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await PurchaseOrderModel.insertMany(pos);
  await CounterModel.updateOne({ _id: "po" }, { $set: { seq: pos.length } }, { upsert: true });
}

// Issue #62 (#54): serial-tracked types are stocked unit by unit — every in-stock
// piece of the seeded catalog gets its own unit document so the whole serial flow
// (reserve → pack → ship → sell) works from the first demo order on.
async function seedStockUnits(types: readonly CatalogTypeConfig[]): Promise<number> {
  if ((await StockUnitModel.countDocuments()) > 0) {
    console.log("stock_units collection not empty — skipping serial units (idempotent)");
    return 0;
  }
  const serialTypes = new Set(
    types.filter((type) => type.stockTracking === "serial").map((type) => type.key),
  );
  if (serialTypes.size === 0) return 0;
  const products = await ProductModel.find({ type: { $in: [...serialTypes] } })
    .select("type variants.sku variants.stock")
    .sort({ slug: 1 })
    .lean<Pick<Product, "type" | "variants">[]>()
    .exec();
  const now = new Date();
  let counter = 0;
  const units = products.flatMap((product) =>
    product.variants.flatMap((variant) =>
      Array.from({ length: variant.stock }, () => {
        counter += 1;
        // Deterministic IMEI-shaped serial (35 + 13 digits, unique by construction).
        const serial = `35${String(counter).padStart(13, "0")}`;
        return {
          sku: variant.sku,
          serial,
          status: "in_stock" as const,
          history: [{ status: "in_stock" as const, at: now, note: "Anfangsbestand" }],
        };
      }),
    ),
  );
  if (units.length > 0) await StockUnitModel.insertMany(units);
  return units.length;
}

async function main(): Promise<void> {
  const fresh = process.argv.includes("--fresh");
  if (fresh && dbMode() === "memory-server" && isDbPathLocked()) {
    console.error(
      "Refusing --fresh: another process holds the data/mongo lock (dev server running?). Stop it first.",
    );
    process.exit(1);
  }
  await connectDB();
  if (fresh) {
    await mongoose.connection.dropDatabase();
    console.log("dropped database (--fresh)");
  }
  const now = new Date();
  const rng = mulberry32(987654321);
  const types = await seedCatalogTypes();
  const shopSettings = await seedShopSettings();
  await seedLanguages();
  await seedTranslations();
  const productCount = await seedProducts();
  const unitCount = await seedStockUnits(types);
  if (unitCount > 0) console.log(`serial units created: ${unitCount}`);
  const repairedFilters = await repairProductFilters(types);
  if (repairedFilters > 0) console.log(`filter blocks recomputed for ${repairedFilters} products`);
  const user = await seedUser();
  if (user.created && user.generatedPassword) {
    console.log(
      `\nAdmin-Benutzer angelegt: ${ADMIN_EMAIL}\nAdmin-Passwort (einmalig angezeigt, bitte notieren): ${user.generatedPassword}\n`,
    );
  } else if (!user.created) {
    console.log(`Admin-Benutzer ${ADMIN_EMAIL} existiert — Passwort unverändert.`);
  }
  const suppliers = await seedSuppliers();
  await seedOrders(rng, now, shopSettings);
  await seedPurchaseOrders(rng, suppliers, now, types);
  const counts = {
    products: await ProductModel.countDocuments(),
    orders: await OrderModel.countDocuments(),
    suppliers: await SupplierModel.countDocuments(),
    purchaseOrders: await PurchaseOrderModel.countDocuments(),
    users: await UserModel.countDocuments(),
  };
  console.log(
    `seed done (db: ${env.MONGODB_URI ? "external" : "memory-server"}, catalog: ${productCount})`,
    counts,
  );
  await disconnectDB();
  process.exit(0);
}

if (!process.env.VITEST) {
  main().catch(async (error: unknown) => {
    console.error("seed failed:", error);
    try {
      await disconnectDB();
    } catch {
      // already down
    }
    process.exit(1);
  });
}
