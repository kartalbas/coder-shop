import { interpolate, label } from "@/lib/i18n";
import { connectDB } from "./db";
import { getRequestLabels } from "./i18n";
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from "@/lib/shop-settings";
import { ShopSettingsModel, toShopSettings } from "@/models/shop-settings";

// Issue #64: every commerce question ("what is the VAT rate? what does shipping cost?
// which payment methods exist?") is answered from this configuration.

export async function getShopSettings(): Promise<ShopSettings> {
  await connectDB();
  const doc = await ShopSettingsModel.findOne({ key: "shop" }).lean().exec();
  if (!doc) return structuredClone(DEFAULT_SHOP_SETTINGS);
  return toShopSettings(doc as never);
}

function uniqueKeys(rows: { key: string }[]): boolean {
  const keys = rows.map((row) => row.key);
  return new Set(keys).size === keys.length;
}

// Creates or updates the shop configuration (seed, admin, tests). The validation
// mirrors the pure shape; deleting the last active method of a kind the shop still
// routes on (any delivery, any payment) is refused so the checkout can never be
// configured into a dead end.
export async function saveShopSettingsCore(
  settings: ShopSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Issue #58 step 3: refusals answer from the translation table in the request
  // language; outside a request scope the first active language answers.
  const labels = await getRequestLabels();
  const withKey = (key: string, value: string) =>
    interpolate(label(labels, key), { key: value });
  if (!Number.isFinite(settings.vatRatePercent) || settings.vatRatePercent < 0 || settings.vatRatePercent > 100) {
    return { ok: false, error: label(labels, "admin.settings.error.vatRange") };
  }
  if (!Number.isInteger(settings.freeShippingFromCents) || settings.freeShippingFromCents < 0) {
    return { ok: false, error: label(labels, "admin.settings.error.freeFrom") };
  }
  if (settings.shippingMethods.length === 0 || !uniqueKeys(settings.shippingMethods)) {
    return { ok: false, error: label(labels, "admin.settings.error.shippingKeys") };
  }
  if (settings.paymentMethods.length === 0 || !uniqueKeys(settings.paymentMethods)) {
    return { ok: false, error: label(labels, "admin.settings.error.paymentKeys") };
  }
  for (const method of settings.shippingMethods) {
    if (!/^[a-z][a-z0-9-]*$/.test(method.key)) {
      return { ok: false, error: withKey("admin.settings.error.shippingKeyShape", method.key) };
    }
    if (!method.label.trim()) {
      return { ok: false, error: withKey("admin.settings.error.shippingNameMissing", method.key) };
    }
    if (!Number.isInteger(method.priceCents) || method.priceCents < 0) {
      return { ok: false, error: withKey("admin.settings.error.shippingPrice", method.key) };
    }
  }
  for (const method of settings.paymentMethods) {
    if (!/^[a-z][a-z0-9-]*$/.test(method.key)) {
      return { ok: false, error: withKey("admin.settings.error.paymentKeyShape", method.key) };
    }
    if (!method.label.trim()) {
      return { ok: false, error: withKey("admin.settings.error.paymentNameMissing", method.key) };
    }
    if (!["immediate", "invoice", "on_pickup"].includes(method.kind)) {
      return { ok: false, error: withKey("admin.settings.error.paymentKind", method.key) };
    }
  }
  if (!settings.shippingMethods.some((method) => method.active)) {
    return { ok: false, error: label(labels, "admin.settings.error.noActiveShipping") };
  }
  if (!settings.paymentMethods.some((method) => method.active)) {
    return { ok: false, error: label(labels, "admin.settings.error.noActivePayment") };
  }
  await connectDB();
  await ShopSettingsModel.updateOne(
    { key: "shop" },
    {
      $set: {
        key: "shop",
        vatRatePercent: settings.vatRatePercent,
        freeShippingFromCents: settings.freeShippingFromCents,
        shippingMethods: settings.shippingMethods,
        paymentMethods: settings.paymentMethods,
      },
    },
    { upsert: true },
  ).exec();
  return { ok: true };
}
