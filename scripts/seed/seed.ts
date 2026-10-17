import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { swissYear } from "@/lib/dates";
import { formatOrderNumber, formatPaymentReference, formatPoNumber } from "@/lib/numbers";
import { HAPPY_PATH } from "@/lib/orders/state-machine";
import { computeTotals, type ShippingMethodName } from "@/lib/pricing";
import { parcelWeightGrams } from "@/lib/shipping/weight";
import { CounterModel } from "@/models/counter";
import { OrderModel, type OrderStatus, type StatusLogEntry } from "@/models/order";
import { ProductModel } from "@/models/product";
import { PurchaseOrderModel } from "@/models/purchase-order";
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

async function seedOrders(rng: () => number, now: Date): Promise<void> {
  if ((await OrderModel.countDocuments()) > 0) {
    console.log("orders collection not empty — skipping sample orders (idempotent)");
    return;
  }
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
    const method: ShippingMethodName = rng() < 0.75 ? "standard" : "express";
    const totals = computeTotals(lines, method);
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
        method,
        ...(shipped
          ? {
              carrier: "ups" as const,
              trackingNumber: mockTrackingNumber(rng),
              parcelWeightGrams: parcelWeightGrams(lines),
            }
          : {}),
      },
      payment: {
        method: "mock" as const,
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
): Promise<void> {
  if ((await PurchaseOrderModel.countDocuments()) > 0) {
    console.log("purchase_orders collection not empty — skipping sample POs (idempotent)");
    return;
  }
  const products = await ProductModel.find().sort({ slug: 1 }).lean();
  const statuses = ["draft", "ordered", "received"] as const;
  const supplierNames = [...suppliers.keys()];
  const year = swissYear(now);
  const pos = [];
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const lines = [];
    for (let l = 0; l < 2; l++) {
      const product = products[(i * 7 + l * 13) % products.length];
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
      ...(status === "received" ? { receivedAt: new Date(createdAt.getTime() + 4 * DAY_MS) } : {}),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await PurchaseOrderModel.insertMany(pos);
  await CounterModel.updateOne({ _id: "po" }, { $set: { seq: pos.length } }, { upsert: true });
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
  const productCount = await seedProducts();
  const user = await seedUser();
  if (user.created && user.generatedPassword) {
    console.log(
      `\nAdmin-Benutzer angelegt: ${ADMIN_EMAIL}\nAdmin-Passwort (einmalig angezeigt, bitte notieren): ${user.generatedPassword}\n`,
    );
  } else if (!user.created) {
    console.log(`Admin-Benutzer ${ADMIN_EMAIL} existiert — Passwort unverändert.`);
  }
  const suppliers = await seedSuppliers();
  await seedOrders(rng, now);
  await seedPurchaseOrders(rng, suppliers, now);
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
