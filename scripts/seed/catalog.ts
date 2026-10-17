import { CATALOG_BRANDS } from "@/lib/brands";
import { deriveFilter, type ProductAttributes } from "@/lib/facets";
import type { ProductType } from "@/models/product";

export interface SeedVariant {
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
  type: ProductType;
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Brands come from the single catalog brand set (src/lib/brands.ts) that the mega-menu
// also renders (issue #31). Weighted so Apple (the flagship brand) has enough products to
// fill more than one listing page (M2 acceptance: `?type=smartphone&brand=Apple`).
const PHONE_BRAND_WEIGHTS: Record<string, number> = {
  Apple: 4,
  Samsung: 2,
  Xiaomi: 2,
  Google: 1,
  OnePlus: 1,
};
const PHONE_BRAND_WEIGHTS_LIST = CATALOG_BRANDS.smartphone.flatMap((brand) =>
  Array<string>(PHONE_BRAND_WEIGHTS[brand] ?? 1).fill(brand),
);

const PHONE_MODELS: Record<string, string[]> = {
  Apple: ["iPhone 16", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone SE"],
  Samsung: ["Galaxy S25", "Galaxy S25 Ultra", "Galaxy A56", "Galaxy Z Flip6"],
  Xiaomi: ["Xiaomi 15", "Xiaomi 15 Pro", "Redmi Note 14", "Poco F7"],
  Google: ["Pixel 10", "Pixel 10 Pro", "Pixel 9a", "Pixel Fold"],
  OnePlus: ["OnePlus 13", "OnePlus 13T", "Nord 5", "Nord CE5"],
};

const SHOE_MODELS: Record<string, string[]> = {
  Nike: ["Air Zoom Pegasus", "Revolution", "Air Max DN", "Vomero"],
  Adidas: ["Ultraboost", "Supernova", "Samba", "Gazelle"],
  Puma: ["Velocity Nitro", "RS-X", "Smash", "Deviate"],
  On: ["Cloudmonster", "Cloudsurfer", "Cloud 5", "Cloudstratus"],
  "New Balance": ["Fresh Foam X", "880", "574", "FuelCell"],
};

const CLOTHING_MODELS: Record<string, string[]> = {
  "The North Face": ["Fleece Jacke", "Daunenweste", "Softshell Jacke", "Softshell Hoodie"],
  "Jack Wolfskin": ["Bergjacke", "Trekking Hose", "Fleece Pullover", "Regenjacke"],
  Mammut: ["Hardshell Jacke", "Wander Hose", "Merino Shirt", "Isolation Weste"],
  Vaude: ["Alpenföhn Jacke", "Rad Trikot", "Wander Socken Set", "Softshell Hose"],
  Patagonia: ["Synthetische Daunenjacke", "Fleece Retro", "T-Shirt Organic", "Flanell Hemd"],
};

// The model tables must cover exactly the shared brand set — a brand without models would
// silently produce no products (issue #31).
for (const [type, models] of [
  ["smartphone", PHONE_MODELS],
  ["shoes", SHOE_MODELS],
  ["clothing", CLOTHING_MODELS],
] as const) {
  const missing = CATALOG_BRANDS[type].filter((brand) => !(brand in models));
  if (missing.length > 0) {
    throw new Error(`catalog.ts: no models for brand(s) ${missing.join(", ")} (${type})`);
  }
}

const PHONE_COLORS = ["schwarz", "weiß", "blau", "grün", "titan", "grau"] as const;
const SHOE_COLORS = ["schwarz", "weiß", "grau", "blau", "rot", "grün"] as const;
const CLOTHING_COLORS = ["schwarz", "anthrazit", "blau", "oliv", "rot", "beige"] as const;
const MATERIALS = ["Baumwolle", "Polyester", "Wolle", "Daune", "Fleece", "Softshell"] as const;
const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const STORAGE_DELTA: Record<number, number> = { 64: 0, 128: 2000, 256: 4500, 512: 9000 };
const COLLECTIONS = ["Neuheiten", "Bestseller", "Sale"] as const;

function stockFor(rng: Rng, threshold: number): number {
  const roll = rng();
  if (roll < 0.05) return 0;
  if (roll < 0.13) return int(rng, 1, Math.max(1, threshold - 1));
  return int(rng, threshold + 2, 80);
}

function phoneVariants(rng: Rng, index: number): SeedVariant[] {
  const colors = [pick(rng, PHONE_COLORS), pick(rng, PHONE_COLORS)].filter(
    (c, i, all) => all.indexOf(c) === i,
  );
  const storages = [64, 128, 256, 512].slice(int(rng, 0, 1), int(rng, 2, 4));
  const variants: SeedVariant[] = [];
  for (const color of colors) {
    for (const storage of storages) {
      const threshold = int(rng, 3, 8);
      variants.push({
        sku: `SP-${String(index).padStart(4, "0")}-${storage}-${slugify(color).toUpperCase()}`,
        label: `${storage} GB / ${color}`,
        priceDeltaCents: STORAGE_DELTA[storage] ?? 0,
        stock: stockFor(rng, threshold),
        restockThreshold: threshold,
        weightGrams: int(rng, 170, 240),
        attributes: { color, storage },
      });
    }
  }
  return variants;
}

function shoeVariants(rng: Rng, index: number): SeedVariant[] {
  const colors = [pick(rng, SHOE_COLORS), pick(rng, SHOE_COLORS)].filter(
    (c, i, all) => all.indexOf(c) === i,
  );
  const start = int(rng, 36, 40);
  const sizes: string[] = [];
  for (let s = start; s <= Math.min(47, start + int(rng, 3, 7)); s++) sizes.push(String(s));
  const variants: SeedVariant[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const threshold = int(rng, 3, 6);
      variants.push({
        sku: `SH-${String(index).padStart(4, "0")}-${size}-${slugify(color).toUpperCase()}`,
        label: `${size} / ${color}`,
        priceDeltaCents: 0,
        stock: stockFor(rng, threshold),
        restockThreshold: threshold,
        weightGrams: int(rng, 600, 1100),
        attributes: { color, size },
      });
    }
  }
  return variants;
}

function clothingVariants(rng: Rng, index: number): SeedVariant[] {
  const colors = [pick(rng, CLOTHING_COLORS), pick(rng, CLOTHING_COLORS)].filter(
    (c, i, all) => all.indexOf(c) === i,
  );
  const material = pick(rng, MATERIALS);
  const start = int(rng, 0, 1);
  const sizes = CLOTHING_SIZES.slice(start, start + int(rng, 4, 6));
  const variants: SeedVariant[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const threshold = int(rng, 3, 6);
      variants.push({
        sku: `CL-${String(index).padStart(4, "0")}-${size}-${slugify(color).toUpperCase()}`,
        label: `${size} / ${color}`,
        priceDeltaCents: size === "XL" || size === "XXL" ? 200 : 0,
        stock: stockFor(rng, threshold),
        restockThreshold: threshold,
        weightGrams: int(rng, 200, 800),
        attributes: { color, size, material },
      });
    }
  }
  return variants;
}

function describe(rng: Rng, name: string, type: ProductType): string {
  const adjectives = ["hochwertige", "vielseitige", "moderne", "robuste", "leichte"];
  const adj = pick(rng, adjectives);
  if (type === "smartphone") {
    return `Das ${name} ist ein ${adj}es Smartphone mit brillantem Display, starker Kamera und zuverlässiger Akkulaufzeit für den Alltag.`;
  }
  if (type === "shoes") {
    return `Der ${name} ist ein ${adj}er Schuh mit angenehmer Dämpfung und gutem Halt – ideal für Training und Freizeit.`;
  }
  return `Die ${name} ist eine ${adj}e Kleidung mit angenehmem Tragekomfort und durchdachter Ausstattung für jedes Wetter.`;
}

function buildProduct(rng: Rng, index: number, type: ProductType): SeedProduct {
  const models =
    type === "smartphone" ? PHONE_MODELS : type === "shoes" ? SHOE_MODELS : CLOTHING_MODELS;
  const brand =
    type === "smartphone" ? pick(rng, PHONE_BRAND_WEIGHTS_LIST) : pick(rng, Object.keys(models));
  const model = pick(rng, models[brand]);
  const name = `${brand} ${model}`;
  const priceCents =
    type === "smartphone"
      ? int(rng, 300, 1500) * 100
      : type === "shoes"
        ? int(rng, 80, 260) * 100
        : int(rng, 25, 190) * 100;
  const variants =
    type === "smartphone"
      ? phoneVariants(rng, index)
      : type === "shoes"
        ? shoeVariants(rng, index)
        : clothingVariants(rng, index);
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
    description: describe(rng, name, type),
    type,
    brand,
    priceCents,
    images,
    featured: roll < 0.15,
    collection: roll > 0.6 ? pick(rng, COLLECTIONS) : undefined,
    filter: deriveFilter(variants),
    variants,
  };
}

export function generateCatalog(seed = 20261017): SeedProduct[] {
  const rng = mulberry32(seed);
  const products: SeedProduct[] = [];
  let index = 1;
  for (let i = 0; i < 70; i++) products.push(buildProduct(rng, index++, "smartphone"));
  for (let i = 0; i < 70; i++) products.push(buildProduct(rng, index++, "shoes"));
  for (let i = 0; i < 60; i++) products.push(buildProduct(rng, index++, "clothing"));
  return products;
}
