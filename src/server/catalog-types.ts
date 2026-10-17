import { connectDB } from "./db";
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
  if (!/^[a-z][a-z0-9-]*$/.test(config.key)) {
    return { ok: false, error: "Typ-Key: Kleinbuchstaben, Ziffern und Bindestriche." };
  }
  if (!config.label.trim()) return { ok: false, error: "Typ-Name fehlt." };
  if (!config.photoNoun.trim()) return { ok: false, error: "Foto-Beschreibung (photoNoun) fehlt." };
  if (config.dimensions.length === 0) {
    return { ok: false, error: "Mindestens eine Variante-Dimension ist nötig." };
  }
  const keys = config.dimensions.map((d) => d.key);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: "Dimensions-Key sind nicht eindeutig." };
  }
  for (const dimension of config.dimensions) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(dimension.key)) {
      return { ok: false, error: `Dimensions-Key ungültig: ${dimension.key}` };
    }
    if (!dimension.label.trim()) return { ok: false, error: `Dimensions-Name fehlt: ${dimension.key}` };
  }
  await connectDB();
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
  return { ok: true };
}
