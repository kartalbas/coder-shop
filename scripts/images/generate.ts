import fs from "node:fs/promises";
import path from "node:path";
import { ProductModel, type ProductType } from "@/models/product";
import { connectDB, disconnectDB } from "@/server/db";
import { env } from "@/server/env";
import { generatePhoto } from "./api";
import { buildImagePrompt, imageAlt, imageSeed, viewForImage, type ImageView } from "./prompt";

const IMAGES_DIR = path.resolve("public/products");
const PHOTO_EXTENSIONS = ["webp", "jpg", "jpeg", "png"] as const;

interface ImageSlot {
  slug: string;
  name: string;
  type: ProductType;
  index: number;
  basename: string;
  color: string;
  material?: string;
  view: ImageView;
  currentSrc: string;
}

interface ProductRow {
  slug: string;
  name: string;
  type: ProductType;
  images: { src: string; alt: string }[];
  variants: { attributes: { color: string; material?: string } }[];
}

function parseLimit(argv: string[]): number | undefined {
  const at = argv.indexOf("--limit");
  if (at === -1) return undefined;
  const value = Number(argv[at + 1]);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`invalid --limit "${argv[at + 1]}" (expected a non-negative integer)`);
    process.exit(1);
  }
  return value;
}

async function findExistingPhoto(basename: string): Promise<string | null> {
  for (const ext of PHOTO_EXTENSIONS) {
    try {
      await fs.access(path.join(IMAGES_DIR, `${basename}.${ext}`));
      return `${basename}.${ext}`;
    } catch {
      // try next extension
    }
  }
  return null;
}

function buildSlots(products: ProductRow[]): ImageSlot[] {
  const slots: ImageSlot[] = [];
  for (const product of products) {
    if (product.variants.length === 0) continue;
    product.images.forEach((image, index) => {
      const variant = product.variants[index % product.variants.length];
      slots.push({
        slug: product.slug,
        name: product.name,
        type: product.type,
        index,
        basename: `${product.slug}-${index + 1}`,
        color: variant.attributes.color,
        ...(variant.attributes.material ? { material: variant.attributes.material } : {}),
        view: viewForImage(index),
        currentSrc: image.src,
      });
    });
  }
  return slots;
}

async function recordPhoto(slot: ImageSlot, file: string): Promise<void> {
  await ProductModel.updateOne(
    { slug: slot.slug },
    {
      $set: {
        [`images.${slot.index}.src`]: `/products/${file}`,
        [`images.${slot.index}.alt`]: imageAlt(slot.name, slot.view),
      },
    },
  );
}

async function generateSlot(slot: ImageSlot, options: { url: string; apiKey: string }) {
  const started = Date.now();
  const prompt = buildImagePrompt({
    type: slot.type,
    color: slot.color,
    view: slot.view,
    ...(slot.material ? { material: slot.material } : {}),
  });
  const buffer = await generatePhoto(prompt, imageSeed(slot.slug, slot.index + 1), options);
  const file = `${slot.basename}.webp`;
  await fs.writeFile(path.join(IMAGES_DIR, file), buffer);
  await recordPhoto(slot, file);
  return { file, seconds: (Date.now() - started) / 1000, kb: Math.round(buffer.length / 1024) };
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  if (!env.LLAMA_API_KEY) {
    console.error("LLAMA_API_KEY is not set — cannot call the image API.");
    process.exit(1);
  }
  const options = { url: env.IMAGE_API_URL, apiKey: env.LLAMA_API_KEY };
  await connectDB();
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const products = await ProductModel.find()
    .sort({ slug: 1 })
    .lean<ProductRow[]>()
    .select("slug name type images variants.attributes");
  const slots = buildSlots(products);
  const total = slots.length;

  let done = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let stoppedAtLimit = false;

  for (const slot of slots) {
    const label = `[${done + 1}/${total}] ${slot.basename} ${slot.view}/${slot.color}`;
    const existing = await findExistingPhoto(slot.basename);
    if (existing) {
      if (slot.currentSrc !== `/products/${existing}`) await recordPhoto(slot, existing);
      skipped += 1;
      done += 1;
      console.log(`${label} — skipped (already on disk)`);
      continue;
    }
    if (limit !== undefined && generated >= limit) {
      stoppedAtLimit = true;
      break;
    }
    done += 1;
    try {
      const result = await generateSlot(slot, options);
      generated += 1;
      console.log(`${label} — ✓ ${result.file} (${result.kb} KB, ${result.seconds.toFixed(1)} s)`);
    } catch (error) {
      failed += 1;
      console.error(`${label} — ✗ ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const remaining = total - done;
  console.log(
    `images: ${generated} generated, ${skipped} already on disk, ${failed} failed` +
      (stoppedAtLimit ? `, ${remaining} not attempted (--limit reached, rerun to continue)` : ""),
  );
  await disconnectDB();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error: unknown) => {
  console.error("image generation run failed:", error);
  try {
    await disconnectDB();
  } catch {
    // already down
  }
  process.exit(1);
});
