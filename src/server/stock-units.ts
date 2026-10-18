import mongoose, { type ClientSession } from "mongoose";
import { normalizeSerial, unitSourcesFor, type StockUnitStatus } from "@/lib/stock-units";
import { PurchaseOrderModel } from "@/models/purchase-order";
import { StockUnitModel, type StockUnit } from "@/models/stock-unit";
import { getCatalogTypes } from "./catalog-types";
import { connectDB } from "./db";

// Issue #62 (#54): all unit-ledger data access. The ledger is only used for types
// whose catalog config tracks serials; quantity types never come through here.

// The type keys whose variants are stocked as individual units.
export async function serialTrackedTypes(): Promise<Set<string>> {
  const types = await getCatalogTypes();
  return new Set(types.filter((type) => type.stockTracking === "serial").map((type) => type.key));
}

export class NotEnoughUnitsError extends Error {
  constructor(readonly sku: string) {
    super(`Not enough in-stock units for ${sku}`);
    this.name = "NotEnoughUnitsError";
  }
}

export class DuplicateSerialError extends Error {
  constructor(readonly serial: string) {
    super(`Serial ${serial} already exists`);
    this.name = "DuplicateSerialError";
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 11000;
}

// Goods receipt of a serial line: every received piece is registered by serial.
// Duplicates (in this batch or against the ledger) are refused. The history note
// names the purchase order (issue #62 review: the trace must be readable per unit).
export async function createReceivedUnits(
  sku: string,
  serials: readonly string[],
  purchaseOrderId: string,
  purchaseOrderNumber: string,
  session: ClientSession,
): Promise<void> {
  const normalized: string[] = [];
  for (const raw of serials) {
    const serial = normalizeSerial(raw);
    if (!serial) throw new Error(`Ungültige Seriennummer „${raw}“.`);
    if (normalized.includes(serial)) throw new DuplicateSerialError(serial);
    normalized.push(serial);
  }
  const now = new Date();
  try {
    await StockUnitModel.insertMany(
      normalized.map((serial) => ({
        sku,
        serial,
        status: "in_stock" as StockUnitStatus,
        purchaseOrderId,
        history: [
          {
            status: "in_stock" as StockUnitStatus,
            at: now,
            note: `Wareneingang ${purchaseOrderNumber}`,
          },
        ],
      })),
      { session, ordered: true },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // The failed insert aborted the transaction — read the committed duplicate
      // outside of it so the error can name the serial.
      const taken = await StockUnitModel.findOne({ sku, serial: { $in: normalized } })
        .lean<StockUnit>()
        .exec();
      throw new DuplicateSerialError(taken?.serial ?? normalized[0] ?? "?");
    }
    throw error;
  }
}

// Checkout: reserve `qty` specific in-stock units for the order. Called inside the
// checkout transaction — a missing unit throws and the whole order rolls back.
export async function reserveUnitsForOrder(
  lines: { sku: string; qty: number }[],
  orderNumber: string,
  session: ClientSession,
): Promise<Map<string, string[]>> {
  const serialsBySku = new Map<string, string[]>();
  const now = new Date();
  for (const line of lines) {
    const serials: string[] = [];
    for (let i = 0; i < line.qty; i++) {
      const unit = await StockUnitModel.findOneAndUpdate(
        { sku: line.sku, status: "in_stock" },
        {
          $set: { status: "reserved" as StockUnitStatus, orderNumber },
          $push: {
            history: {
              status: "reserved" as StockUnitStatus,
              at: now,
              note: `Bestellung ${orderNumber}`,
            },
          },
        },
        { session, returnDocument: "after", sort: { _id: 1 } },
      )
        .select("serial")
        .lean<StockUnit>()
        .exec();
      if (!unit) throw new NotEnoughUnitsError(line.sku);
      serials.push(unit.serial);
    }
    serialsBySku.set(line.sku, serials);
  }
  return serialsBySku;
}

// Fulfillment: every unit of the order moves to the next status (packed/shipped/sold) —
// only from a status the unit chain allows, so a unit can never skip a step.
export async function advanceUnitsForOrder(
  orderNumber: string,
  to: StockUnitStatus,
  note: string,
  session?: ClientSession,
): Promise<void> {
  const now = new Date();
  await StockUnitModel.updateMany(
    { orderNumber, status: { $in: unitSourcesFor(to) } },
    { $set: { status: to }, $push: { history: { status: to, at: now, note } } },
    ...(session ? [{ session }] : []),
  );
}

// Cancel with restock: the order's units go back on the shelf.
export async function releaseUnitsForOrder(
  orderNumber: string,
  session: ClientSession,
): Promise<void> {
  const now = new Date();
  await StockUnitModel.updateMany(
    { orderNumber, status: { $in: unitSourcesFor("in_stock") } },
    {
      $set: { status: "in_stock" as StockUnitStatus, orderNumber: null },
      $push: {
        history: { status: "in_stock" as StockUnitStatus, at: now, note: "Storno — zurück ins Lager" },
      },
    },
    { session },
  );
}

// ---------- admin views ----------

export interface StockUnitListItem {
  id: string;
  sku: string;
  serial: string;
  status: StockUnitStatus;
  orderNumber?: string;
  purchaseOrderId?: string;
  // Issue #62 review: the PO number makes the serial → purchase-order trace
  // clickable in the admin ledger, not just a raw id.
  purchaseOrderNumber?: string;
  history: { status: StockUnitStatus; at: Date; note?: string }[];
}

function toListItem(unit: StockUnit, purchaseOrderNumber?: string): StockUnitListItem {
  return {
    id: unit._id.toString(),
    sku: unit.sku,
    serial: unit.serial,
    status: unit.status,
    ...(unit.orderNumber !== undefined && { orderNumber: unit.orderNumber }),
    ...(unit.purchaseOrderId !== undefined && { purchaseOrderId: unit.purchaseOrderId.toString() }),
    ...(purchaseOrderNumber !== undefined && { purchaseOrderNumber }),
    history: unit.history,
  };
}

export const STOCK_UNIT_LIST_LIMIT = 200;

// Search the ledger by serial or SKU (exact-prefix on either), newest first.
export async function searchStockUnits(query: string): Promise<StockUnitListItem[]> {
  await connectDB();
  const trimmed = query.trim();
  const filter: Record<string, unknown> = {};
  if (trimmed) {
    const rx = new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    filter.$or = [{ serial: rx }, { sku: rx }];
  }
  const units = await StockUnitModel.find(filter)
    .sort({ updatedAt: -1 })
    .limit(STOCK_UNIT_LIST_LIMIT)
    .lean<StockUnit[]>()
    .exec();
  const poIds = [...new Set(units.map((unit) => unit.purchaseOrderId?.toString()).filter((id): id is string => Boolean(id)))];
  const poNumbers = new Map<string, string>();
  if (poIds.length > 0) {
    const pos = await PurchaseOrderModel.find({ _id: { $in: poIds } })
      .select("poNumber")
      .lean<{ _id: mongoose.Types.ObjectId; poNumber: string }[]>()
      .exec();
    for (const po of pos) poNumbers.set(po._id.toString(), po.poNumber);
  }
  return units.map((unit) =>
    toListItem(unit, unit.purchaseOrderId ? poNumbers.get(unit.purchaseOrderId.toString()) : undefined),
  );
}
