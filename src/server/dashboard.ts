import type { Types } from "mongoose";
import { isLowStock } from "@/lib/stock";
import { OrderModel, type OrderStatus } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { connectDB } from "./db";
import type { OrderListItem } from "./orders-admin";

export const REVENUE_STATUSES: OrderStatus[] = [
  "paid",
  "picking",
  "packed",
  "shipped",
  "delivered",
];

export const OPEN_ORDER_STATUSES: OrderStatus[] = ["new", "paid", "picking", "packed"];

export const REVENUE_WINDOW_DAYS = 30;

export interface LowStockRow {
  productId: string;
  slug: string;
  productName: string;
  sku: string;
  variantLabel: string;
  stock: number;
  restockThreshold: number;
}

export interface DashboardData {
  revenueCents: number;
  revenueSeries: number[];
  openOrders: number;
  pendingShipments: number;
  lowStock: LowStockRow[];
  recentOrders: OrderListItem[];
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function revenueLastDays(
  days: number,
  now: Date,
): Promise<{ totalCents: number; series: number[] }> {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await OrderModel.aggregate<{ _id: string; cents: number }>([
    { $match: { status: { $in: REVENUE_STATUSES }, createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        cents: { $sum: "$totals.totalCents" },
      },
    },
  ]);
  const byDay = new Map(rows.map((row) => [row._id, row.cents]));

  const series: number[] = [];
  let totalCents = 0;
  for (let offset = days - 1; offset >= 0; offset--) {
    const key = dayKey(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000));
    const cents = byDay.get(key) ?? 0;
    series.push(cents);
    totalCents += cents;
  }
  return { totalCents, series };
}

export async function getLowStockVariants(limit = 25): Promise<LowStockRow[]> {
  const products = await ProductModel.find()
    .sort({ name: 1 })
    .lean<Pick<Product, "_id" | "slug" | "name" | "variants">[]>()
    .exec();
  const rows: LowStockRow[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      if (isLowStock(variant.stock, variant.restockThreshold)) {
        rows.push({
          productId: product._id.toString(),
          slug: product.slug,
          productName: product.name,
          sku: variant.sku,
          variantLabel: variant.label,
          stock: variant.stock,
          restockThreshold: variant.restockThreshold,
        });
      }
    }
  }
  rows.sort((a, b) => a.stock - b.stock || a.productName.localeCompare(b.productName));
  return rows.slice(0, limit);
}

async function getOpenOrders(): Promise<{ open: number; pendingShipments: number }> {
  const [open, pendingShipments] = await Promise.all([
    OrderModel.countDocuments({ status: { $in: OPEN_ORDER_STATUSES } }),
    OrderModel.countDocuments({ status: "packed" }),
  ]);
  return { open, pendingShipments };
}

async function getRecentOrders(limit: number): Promise<OrderListItem[]> {
  const orders = await OrderModel.find()
    .select("orderNumber status createdAt customer totals lines")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<
      {
        _id: Types.ObjectId;
        orderNumber: string;
        status: OrderStatus;
        createdAt: Date;
        customer: { name: string };
        totals: { totalCents: number };
        lines: { qty: number }[];
      }[]
    >()
    .exec();
  return orders.map((order) => ({
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    customerName: order.customer.name,
    totalCents: order.totals.totalCents,
    itemCount: order.lines.reduce((sum, line) => sum + line.qty, 0),
  }));
}

export async function getDashboardData(now = new Date()): Promise<DashboardData> {
  await connectDB();
  const [revenue, counts, lowStock, recentOrders] = await Promise.all([
    revenueLastDays(REVENUE_WINDOW_DAYS, now),
    getOpenOrders(),
    getLowStockVariants(),
    getRecentOrders(8),
  ]);
  return {
    revenueCents: revenue.totalCents,
    revenueSeries: revenue.series,
    openOrders: counts.open,
    pendingShipments: counts.pendingShipments,
    lowStock,
    recentOrders,
  };
}
