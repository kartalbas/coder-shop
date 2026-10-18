// Issue #58 editor slice: the typed reader of `translation-previews.json` (namespace →
// route template, the `translation-seed.ts` pattern) plus the request-time sample
// resolution — `{slug}` is the first product by slug, `{number}` the newest order;
// queries, not constants, so an empty collection simply yields no preview link.
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import type { PreviewSamples, PreviewTable } from "@/lib/translation-previews";
import previewsJson from "./translation-previews.json";

export const PREVIEW_TABLE: PreviewTable = previewsJson;

export async function resolvePreviewSamples(path: string): Promise<PreviewSamples> {
  const samples: PreviewSamples = {};
  if (path.includes("{slug}")) {
    const product = await ProductModel.findOne().sort({ slug: 1 }).select("slug").lean();
    if (product) samples.slug = product.slug;
  }
  if (path.includes("{number}")) {
    const order = await OrderModel.findOne().sort({ createdAt: -1 }).select("orderNumber").lean();
    if (order) samples.number = order.orderNumber;
  }
  return samples;
}
