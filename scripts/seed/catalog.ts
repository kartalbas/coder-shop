import { COLLECTIONS } from "@/lib/collections";
import {
  DEFAULT_CATALOG_TYPES,
  variantLabel,
  type CatalogDimensionConfig,
  type CatalogTypeConfig,
} from "@/lib/catalog-types";
import { deriveFilter, type ProductAttributes } from "@/lib/facets";
import { slugify } from "@/lib/slug";

// Demo catalog generator (the seed's content). Issue #61: the product types, their
// dimensions and brands come from the catalog type configuration
// (`DEFAULT_CATALOG_TYPES` — the seed content of `product_type_configs`); what lives
// here is the per-dimension value pools and demo copy, i.e. seed content, not
// app logic. A type without seed content simply gets no generated products.

interface SeedVariant {
  sku: string;
  label: string;
  priceDeltaCents: number;
  stock: number;
  restockThreshold: number;
  weightGrams: number;
  attributes: ProductAttributes;
}

export interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  type: string;
  brand: string;
  priceCents: number;
  images: { src: string; alt: string }[];
  featured: boolean;
  collection?: string;
  filter: ReturnType<typeof deriveFilter>;
  variants: SeedVariant[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// Seed content per type key: demo models per brand, price/weight ranges, the value
// pools for each dimension and the German description grammar.
interface SeedTypeContent {
  count: number;
  skuPrefix: string;
  priceCents: [number, number];
  weightGrams: [number, number];
  models: Record<string, readonly string[]>;
  brandWeights?: Record<string, number>;
  pools: Record<string, readonly string[]>;
  // Cents added per pool position of a dimension (e.g. more storage → pricier).
  priceSteps?: Record<string, number>;
  describe: (name: string, adjective: string) => string;
}

// Swiss spelling: „weiss“, not „weiß“ (issue #28).
const SHOE_SIZES = Array.from({ length: 12 }, (_, i) => String(36 + i));
const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const SEED_TYPE_CONTENT: Record<string, SeedTypeContent> = {
  smartphone: {
    count: 70,
    skuPrefix: "SP",
    priceCents: [30000, 150000],
    weightGrams: [170, 240],
    // Weighted so Apple (the flagship brand) fills more than one listing page
    // (M2 acceptance: `?type=smartphone&brand=Apple`).
    brandWeights: { Apple: 4, Samsung: 2, Xiaomi: 2, Google: 1, OnePlus: 1 },
    models: {
      Apple: ["iPhone 16", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone SE"],
      Samsung: ["Galaxy S25", "Galaxy S25 Ultra", "Galaxy A56", "Galaxy Z Flip6"],
      Xiaomi: ["Xiaomi 15", "Xiaomi 15 Pro", "Redmi Note 14", "Poco F7"],
      Google: ["Pixel 10", "Pixel 10 Pro", "Pixel 9a", "Pixel Fold"],
      OnePlus: ["OnePlus 13", "OnePlus 13T", "Nord 5", "Nord CE5"],
    },
    pools: {
      color: ["schwarz", "weiss", "blau", "grün", "titan", "grau"],
      storage: ["64", "128", "256", "512"],
    },
    priceSteps: { storage: 2250 },
    // Issue #28: adjective stems, declined per gender — the old predicative forms
    // („hochwertige“) plus the appended ending produced „hochwertigeer“, „leichtees“.
    describe: (name, adj) =>
      `Das ${name} ist ein ${adj}es Smartphone mit brillantem Display, starker Kamera und zuverlässiger Akkulaufzeit für den Alltag.`,
  },
  shoes: {
    count: 70,
    skuPrefix: "SH",
    priceCents: [8000, 26000],
    weightGrams: [600, 1100],
    models: {
      Nike: ["Air Zoom Pegasus", "Revolution", "Air Max DN", "Vomero"],
      Adidas: ["Ultraboost", "Supernova", "Samba", "Gazelle"],
      Puma: ["Velocity Nitro", "RS-X", "Smash", "Deviate"],
      On: ["Cloudmonster", "Cloudsurfer", "Cloud 5", "Cloudstratus"],
      "New Balance": ["Fresh Foam X", "880", "574", "FuelCell"],
    },
    pools: {
      color: ["schwarz", "weiss", "grau", "blau", "rot", "grün"],
      size: SHOE_SIZES,
    },
    describe: (name, adj) =>
      `Der ${name} ist ein ${adj}er Schuh mit angenehmer Dämpfung und gutem Halt – ideal für Training und Freizeit.`,
  },
  clothing: {
    count: 60,
    skuPrefix: "CL",
    priceCents: [2500, 19000],
    weightGrams: [200, 800],
    models: {
      "The North Face": ["Fleece Jacke", "Daunenweste", "Softshell Jacke", "Softshell Hoodie"],
      "Jack Wolfskin": ["Bergjacke", "Trekking Hose", "Fleece Pullover", "Regenjacke"],
      Mammut: ["Hardshell Jacke", "Wander Hose", "Merino Shirt", "Isolation Weste"],
      Vaude: ["Alpenföhn Jacke", "Rad Trikot", "Wander Socken Set", "Softshell Hose"],
      Patagonia: ["Synthetische Daunenjacke", "Fleece Retro", "T-Shirt Organic", "Flanell Hemd"],
    },
    pools: {
      color: ["schwarz", "anthrazit", "blau", "oliv", "rot", "beige"],
      size: CLOTHING_SIZES,
      material: ["Baumwolle", "Polyester", "Wolle", "Daune", "Fleece", "Softshell"],
    },
    priceSteps: { size: 40 },
    describe: (name, adj) =>
      `Die ${name} ist eine ${adj}e Kleidung mit angenehmem Tragekomfort und durchdachter Ausstattung für jedes Wetter.`,
  },
};

// The model tables must cover exactly the configured brands — a brand without models
// would silently produce no products (issue #31).
for (const type of DEFAULT_CATALOG_TYPES) {
  const content = SEED_TYPE_CONTENT[type.key];
  if (!content) continue;
  const missing = type.brands.filter((brand) => !(brand in content.models));
  if (missing.length > 0) {
    throw new Error(`catalog.ts: no models for brand(s) ${missing.join(", ")} (${type.key})`);
  }
}

function stockFor(rng: Rng, threshold: number, type: CatalogTypeConfig): number {
  // Issue #62 (#54): a serial-tracked type is stocked like a real phone shelf — a
  // handful of units per variant, each one a unit document with its own serial.
  if (type.stockTracking === "serial") {
    const roll = rng();
    if (roll < 0.1) return 0;
    return int(rng, 1, 8);
  }
  const roll = rng();
  if (roll < 0.05) return 0;
  if (roll < 0.13) return int(rng, 1, Math.max(1, threshold - 1));
  return int(rng, threshold + 2, 80);
}

// The values one dimension takes on a product: a small colour selection, a contiguous
// range for ordered dimensions (EU sizes, garment sizes, storage), one or two values
// for other free-text dimensions.
function dimensionValues(
  rng: Rng,
  dimension: CatalogDimensionConfig,
  pool: readonly string[] | undefined,
): string[] {
  if (!pool || pool.length === 0) return [];
  if (dimension.order === "numeric" || dimension.order === "clothing-size") {
    const start = int(rng, 0, Math.min(4, Math.max(0, pool.length - 2)));
    const maxSpan = Math.min(8, Math.max(2, pool.length - start));
    return pool.slice(start, Math.min(pool.length, start + int(rng, 2, maxSpan)));
  }
  const count = Math.min(pool.length, int(rng, 1, 2));
  const chosen = new Set<string>();
  while (chosen.size < count) chosen.add(pick(rng, pool));
  return [...chosen];
}

function buildVariants(
  rng: Rng,
  index: number,
  type: CatalogTypeConfig,
  content: SeedTypeContent,
): SeedVariant[] {
  const valueSets = type.dimensions.map((dimension) =>
    dimensionValues(rng, dimension, content.pools[dimension.key]),
  );
  if (valueSets.some((values) => values.length === 0)) return [];

  let combinations: string[][] = [[]];
  for (const values of valueSets) {
    combinations = combinations.flatMap((prefix) => values.map((value) => [...prefix, value]));
  }

  return combinations.map((values) => {
    const attributes: ProductAttributes = {};
    let priceDeltaCents = 0;
    type.dimensions.forEach((dimension, position) => {
      const value = values[position];
      attributes[dimension.key] = value;
      const step = content.priceSteps?.[dimension.key];
      if (step) priceDeltaCents += (content.pools[dimension.key]?.indexOf(value) ?? 0) * step;
    });
    const threshold = int(rng, 3, 8);
    return {
      sku: [
        content.skuPrefix,
        String(index).padStart(4, "0"),
        ...values.map((value) => slugify(value).toUpperCase()),
      ].join("-"),
      label: variantLabel(type.dimensions, attributes),
      priceDeltaCents,
      stock: stockFor(rng, threshold, type),
      restockThreshold: threshold,
      weightGrams: int(rng, content.weightGrams[0], content.weightGrams[1]),
      attributes,
    };
  });
}

export function describe(rng: Rng, name: string, type: string): string {
  const adjectives = ["hochwertig", "vielseitig", "modern", "robust", "leicht"];
  return (SEED_TYPE_CONTENT[type]?.describe ?? ((n, adj) => `${n} — ${adj}.`))(name, pick(rng, adjectives));
}

function pickBrand(rng: Rng, type: CatalogTypeConfig, content: SeedTypeContent): string {
  const weights = content.brandWeights;
  const list = weights
    ? type.brands.flatMap((brand) => Array<string>(weights[brand] ?? 1).fill(brand))
    : [...type.brands];
  return pick(rng, list);
}

function buildProduct(rng: Rng, index: number, type: CatalogTypeConfig): SeedProduct | null {
  const content = SEED_TYPE_CONTENT[type.key];
  if (!content) return null;
  const brand = pickBrand(rng, type, content);
  const model = pick(rng, content.models[brand]);
  const name = `${brand} ${model}`;
  const priceCents = int(rng, content.priceCents[0], content.priceCents[1]);
  const variants = buildVariants(rng, index, type, content);
  if (variants.length === 0) return null;
  const slug = `${slugify(name)}-${String(index).padStart(3, "0")}`;
  const imageCount = int(rng, 1, 5);
  const images = Array.from({ length: imageCount }, (_, n) => ({
    src: `/products/${slug}-${n + 1}.webp`,
    alt: `${name} – Ansicht ${n + 1}`,
  }));
  const roll = rng();
  return {
    slug,
    name,
    description: describe(rng, name, type.key),
    type: type.key,
    brand,
    priceCents,
    images,
    featured: roll < 0.15,
    collection: roll > 0.6 ? pick(rng, COLLECTIONS) : undefined,
    filter: deriveFilter(variants, type.dimensions),
    variants,
  };
}

export function generateCatalog(seed = 20261017): SeedProduct[] {
  const rng = mulberry32(seed);
  const products: SeedProduct[] = [];
  let index = 1;
  for (const type of [...DEFAULT_CATALOG_TYPES].sort((a, b) => a.position - b.position)) {
    const content = SEED_TYPE_CONTENT[type.key];
    if (!content) continue;
    for (let i = 0; i < content.count; i++) {
      const product = buildProduct(rng, index++, type);
      if (product) products.push(product);
    }
  }
  return products;
}
