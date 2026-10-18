import { escapeRegex } from "@/lib/regex";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { SupplierModel } from "@/models/supplier";
import { UserModel } from "@/models/user";
import { connectDB } from "./db";

// Admin command palette (issue #49): one query, hits from every entity an admin
// jumps to — orders (number or customer), products (name, brand, SKU), customers
// and suppliers. Pure data in, links out; the palette component turns hrefs into
// navigation.

// #58 step 5: the group is a machine key, not a German word — the palette renders the
// row of the request language (the typed-error/emailTaken precedent). The supplier lead
// time travels as data for the same reason.
export type PaletteGroup = "orders" | "products" | "customers" | "suppliers";

export interface PaletteHit {
  id: string;
  group: PaletteGroup;
  primary: string;
  secondary?: string;
  leadTimeDays?: number;
  href: string;
}

const HITS_PER_GROUP = 5;

export async function commandSearchCore(query: string): Promise<PaletteHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  await connectDB();
  const regex = { $regex: escapeRegex(trimmed), $options: "i" };

  const [orders, products, customers, suppliers] = await Promise.all([
    OrderModel.find({
      $or: [{ orderNumber: regex }, { "customer.name": regex }, { "customer.email": regex }],
    })
      .select("orderNumber customer.name customer.email status")
      .sort({ createdAt: -1 })
      .limit(HITS_PER_GROUP)
      .lean()
      .exec(),
    ProductModel.find({ $or: [{ name: regex }, { brand: regex }, { "variants.sku": regex }] })
      .select("name brand type")
      .limit(HITS_PER_GROUP)
      .lean()
      .exec(),
    UserModel.find({ role: "customer", $or: [{ name: regex }, { email: regex }] })
      .select("name email")
      .sort({ name: 1 })
      .limit(HITS_PER_GROUP)
      .lean()
      .exec(),
    SupplierModel.find({ name: regex }).select("name leadTimeDays").limit(HITS_PER_GROUP).lean().exec(),
  ]);

  return [
    ...orders.map((order) => ({
      id: `order-${order._id}`,
      group: "orders" as const,
      primary: order.orderNumber,
      secondary: `${order.customer.name} · ${order.customer.email}`,
      href: `/admin/orders/${order._id}`,
    })),
    ...products.map((product) => ({
      id: `product-${product._id}`,
      group: "products" as const,
      primary: product.name,
      secondary: product.brand,
      href: `/admin/products/${product._id}`,
    })),
    ...customers.map((customer) => ({
      id: `customer-${customer._id}`,
      group: "customers" as const,
      primary: customer.name,
      secondary: customer.email,
      href: `/admin/customers/${customer._id}`,
    })),
    ...suppliers.map((supplier) => ({
      id: `supplier-${supplier._id}`,
      group: "suppliers" as const,
      primary: supplier.name,
      leadTimeDays: supplier.leadTimeDays,
      href: `/admin/suppliers?edit=${supplier._id}`,
    })),
  ];
}
