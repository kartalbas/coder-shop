import { label } from "@/lib/i18n";
import { ProductModel, type Product } from "@/models/product";
import { RestockAlertModel } from "@/models/restock-alert";
import { restockAlertMail } from "@/lib/mail-templates";
import { absoluteUrl } from "@/lib/site";
import { connectDB } from "./db";
import { getRequestLabels } from "./i18n";
import { sendMail } from "./mail";

// Back-in-stock alerts (issue #46): customers leave an e-mail for a sold-out variant;
// whenever stock actually arrives (goods receipt, cancel restock) the waiting
// addresses are notified once — through the same outbox/SMTP transport as everything
// else (#44).

export type SubscribeResult =
  | { ok: true; inStock: boolean }
  | { ok: false; error: string };

export async function subscribeRestockAlertCore(
  sku: string,
  email: string,
): Promise<SubscribeResult> {
  const labels = await getRequestLabels();
  await connectDB();
  const product = await ProductModel.findOne({ "variants.sku": sku })
    .select("slug variants")
    .lean<Product>()
    .exec();
  if (!product) return { ok: false, error: label(labels, "shop.restock.error.notFound") };
  const variant = product.variants.find((v) => v.sku === sku);
  if (!variant) return { ok: false, error: label(labels, "shop.restock.error.notFound") };
  if (variant.stock > 0) return { ok: true, inStock: true };

  const normalized = email.trim().toLowerCase();
  try {
    await RestockAlertModel.create({
      _id: `${sku}|${normalized}`,
      sku,
      email: normalized,
      productSlug: product.slug,
      variantLabel: variant.label,
      createdAt: new Date(),
    });
  } catch (error) {
    // Already on the list — the unique _id says so; that is still a success.
    if ((error as { code?: number }).code === 11000) return { ok: true, inStock: false };
    throw error;
  }
  return { ok: true, inStock: false };
}

// Notify every waiting address whose variant is now in stock. Returns the number of
// mails sent; each alert is stamped so a second restock does not mail again.
export async function notifyRestockedCore(skus: string[]): Promise<number> {
  if (skus.length === 0) return 0;
  await connectDB();
  const products = await ProductModel.find({ "variants.sku": { $in: skus } })
    .select("name slug variants")
    .lean<Product[]>()
    .exec();
  const inStock = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (skus.includes(variant.sku) && variant.stock > 0) inStock.add(variant.sku);
    }
  }
  if (inStock.size === 0) return 0;

  const alerts = await RestockAlertModel.find({ sku: { $in: [...inStock] }, notifiedAt: null })
    .lean()
    .exec();
  let sent = 0;
  for (const alert of alerts) {
    const product = products.find((candidate) => candidate.slug === alert.productSlug);
    // Same rule as every workflow mail (#44): a failing mail never fails the workflow.
    try {
      await sendMail({
        to: alert.email,
        ...restockAlertMail({
          productName: product?.name ?? alert.productSlug,
          variantLabel: alert.variantLabel,
          link: absoluteUrl(`/products/${alert.productSlug}`),
        }),
      });
      await RestockAlertModel.updateOne({ _id: alert._id }, { $set: { notifiedAt: new Date() } });
      sent += 1;
    } catch (error) {
      console.error(`Benachrichtigung für ${alert.sku} fehlgeschlagen`, error);
    }
  }
  return sent;
}
