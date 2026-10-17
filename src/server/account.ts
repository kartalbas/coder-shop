import mongoose from "mongoose";
import { OrderModel, type Order, type OrderStatus } from "@/models/order";
import { ProductModel, type Product } from "@/models/product";
import { UserModel } from "@/models/user";
import { connectDB } from "./db";

export interface AccountOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  totalCents: number;
  itemCount: number;
  trackingNumber?: string;
  // Store pickup (issue #41): the code to show at the counter.
  pickupCode?: string;
}

// Orders of the account: everything ordered while logged in, plus guest orders with the
// same e-mail (which the portal can claim). Newest first, optional search over the order
// number and the product names.
export async function listAccountOrders(
  userId: string,
  search = "",
): Promise<AccountOrderSummary[]> {
  await connectDB();
  const user = await UserModel.findById(userId).select("email").lean().exec();
  if (!user) return [];

  const or: Record<string, unknown>[] = [{ userId }];
  if (user.email) or.push({ "customer.email": user.email });

  const filter: Record<string, unknown> = { $or: or };
  const term = search.trim();
  if (term) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$and = [
      {
        $or: [
          { orderNumber: { $regex: safe, $options: "i" } },
          { "lines.name": { $regex: safe, $options: "i" } },
        ],
      },
    ];
  }

  const orders = await OrderModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .select("orderNumber status createdAt totals lines shipping.trackingNumber shipping.pickup.code")
    .lean<Order[]>()
    .exec();

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    totalCents: order.totals.totalCents,
    itemCount: order.lines.reduce((sum, line) => sum + line.qty, 0),
    ...(order.shipping.trackingNumber !== undefined && {
      trackingNumber: order.shipping.trackingNumber,
    }),
    ...(order.shipping.pickup?.code !== undefined && {
      pickupCode: order.shipping.pickup.code,
    }),
  }));
}

export interface ReorderLine {
  sku: string;
  qty: number;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  imageSrc: string;
  unitPriceCents: number;
  available: boolean;
}

// "Erneut bestellen": current prices and stock per ordered SKU — the cart gets what
// actually exists today, not the historical line.
export async function getReorderLinesCore(
  userId: string,
  orderNumber: string,
): Promise<ReorderLine[] | null> {
  await connectDB();
  const user = await UserModel.findById(userId).select("email").lean().exec();
  if (!user) return null;
  const order = await OrderModel.findOne({ orderNumber })
    .select("userId customer.email lines")
    .lean<Order | null>()
    .exec();
  if (!order) return null;
  const owns =
    (order.userId && order.userId.toString() === userId) ||
    order.customer.email.trim().toLowerCase() === user.email;
  if (!owns) return null;

  const skus = order.lines.map((line) => line.sku);
  type LeanProductSource = Pick<Product, "slug" | "images" | "priceCents" | "variants"> & {
    _id: mongoose.Types.ObjectId;
  };
  const products = await ProductModel.find({ "variants.sku": { $in: skus } })
    .select("_id slug images priceCents variants")
    .lean<LeanProductSource[]>()
    .exec();
  const bySku = new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [
        variant.sku,
        {
          productId: product._id.toString(),
          slug: product.slug,
          imageSrc: product.images[0]?.src ?? "",
          stock: variant.stock,
          priceCents: product.priceCents + variant.priceDeltaCents,
          label: variant.label,
        },
      ]),
    ),
  );

  return order.lines.map((line) => {
    const variant = bySku.get(line.sku);
    return {
      sku: line.sku,
      qty: line.qty,
      productId: variant?.productId ?? line.productId.toString(),
      slug: variant?.slug ?? "",
      name: line.name,
      variantLabel: variant?.label ?? line.variantLabel,
      imageSrc: variant?.imageSrc ?? "",
      unitPriceCents: variant?.priceCents ?? line.unitPriceCents,
      available: variant !== undefined && variant.stock >= line.qty,
    };
  });
}
