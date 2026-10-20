import { CONFIG_KEY_PATTERN, interpolate, label, typeLabelKey } from "@/lib/i18n";
import { connectDB } from "./db";
import { getRequestLabels, getTranslations, saveTranslationCore } from "./i18n";
import { DEFAULT_CATALOG_TYPES, type CatalogTypeConfig } from "@/lib/catalog-types";
import {
  ProductTypeConfigModel,
  toCatalogTypeConfig,
} from "@/models/product-type-config";

// Issue #61: every catalog question ("which types exist? what are a type's dimensions
// and facets? how is stock tracked?") is answered from this configuration.

export async function getCatalogTypes(): Promise<CatalogTypeConfig[]> {
  await connectDB();
  const docs = await ProductTypeConfigModel.find().sort({ position: 1 }).lean().exec();
  if (docs.length === 0) return [...DEFAULT_CATALOG_TYPES];
  return docs.map((doc) => toCatalogTypeConfig(doc as never));
}

export async function getCatalogType(key: string): Promise<CatalogTypeConfig | undefined> {
  const types = await getCatalogTypes();
  return types.find((type) => type.key === key);
}

// Creates or updates a type configuration (seed, admin, tests). Validation mirrors the
// pure shape: unique dimension keys, at least one dimension.
export async function saveCatalogTypeCore(
  config: CatalogTypeConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Issue #58 step 3: refusals answer from the translation table in the request
  // language; outside a request scope the first active language answers.
  const labels = await getRequestLabels();
  const withKey = (key: string, value: string) =>
    interpolate(label(labels, key), { key: value });
  if (!CONFIG_KEY_PATTERN.test(config.key)) {
    return { ok: false, error: label(labels, "admin.catalogTypes.error.keyShape") };
  }
  if (!config.label.trim()) return { ok: false, error: label(labels, "admin.catalogTypes.error.nameMissing") };
  if (!config.photoNoun.trim()) {
    return { ok: false, error: label(labels, "admin.catalogTypes.error.photoNounMissing") };
  }
  if (config.dimensions.length === 0) {
    return { ok: false, error: label(labels, "admin.catalogTypes.error.dimensionsRequired") };
  }
  const keys = config.dimensions.map((d) => d.key);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: label(labels, "admin.catalogTypes.error.dimensionKeys") };
  }
  for (const dimension of config.dimensions) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(dimension.key)) {
      return { ok: false, error: withKey("admin.catalogTypes.error.dimensionKeyShape", dimension.key) };
    }
    if (!dimension.label.trim()) {
      return { ok: false, error: withKey("admin.catalogTypes.error.dimensionNameMissing", dimension.key) };
    }
  }
  await connectDB();
  const stored = await ProductTypeConfigModel.findOne({ key: config.key }).lean().exec();
  await ProductTypeConfigModel.updateOne(
    { key: config.key },
    {
      $set: {
        label: config.label,
        position: config.position,
        stockTracking: config.stockTracking,
        comparable: config.comparable,
        photoNoun: config.photoNoun,
        brands: config.brands,
        dimensions: config.dimensions,
      },
    },
    { upsert: true },
  ).exec();

  // Issue #58 step B2: the configuration is the German truth — a changed label syncs
  // the existing `catalog.type.<key>` row through the one validated core (history, the
  // `textUpdatedAt.de` stamp that flags the other languages for review, cache
  // invalidation). Synced, never created: a type without translations needs no row,
  // `contentLabel`'s fallback answers the configured label.
  if (stored && stored.label !== config.label) {
    const key = typeLabelKey(config.key);
    if ((await getTranslations()).some((row) => row.key === key)) {
      await saveTranslationCore({ key, area: "catalog", de: config.label, texts: {} });
    }
  }
  return { ok: true };
}
