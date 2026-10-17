import { z } from "zod";
import { isPhotoSrc } from "@/lib/images";

export const productCoreSchema = z.object({
  name: z.string().trim().min(2, "Name ist erforderlich.").max(120),
  description: z.string().trim().min(10, "Beschreibung ist erforderlich.").max(2000),
  brand: z.string().trim().min(1, "Marke ist erforderlich.").max(60),
  priceCents: z.coerce.number().int("Ganze Rappen erforderlich.").min(0),
});

export type ProductCoreInput = z.infer<typeof productCoreSchema>;

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const variantCoreSchema = z.object({
  priceDeltaCents: z.coerce.number().int("Ganze Rappen erforderlich.").min(-100000).max(100000),
  stock: z.coerce.number().int("Ganze Stückzahl erforderlich.").min(0),
  // Stock the editor loaded; a stock edit is only applied while the DB still has it (issue #13).
  expectedStock: z.coerce.number().int().min(0),
  weightGrams: z.coerce.number().int("Ganze Gramm erforderlich.").min(1).max(100000),
  attributes: z.object({
    color: z.string().trim().min(1, "Farbe ist erforderlich.").max(40),
    size: z.preprocess(emptyToUndefined, z.string().trim().max(10).optional()),
    storage: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(8192).optional()),
    material: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  }),
});

export type VariantCoreInput = z.infer<typeof variantCoreSchema>;

export const MIN_PRODUCT_IMAGES = 1;
export const MAX_PRODUCT_IMAGES = 5;

const productImageSchema = z.object({
  src: z
    .string()
    .trim()
    .min(1, "Bildpfad ist erforderlich.")
    .max(300)
    .refine(
      (src) => src.startsWith("/products/") && isPhotoSrc(src),
      "Bildpfad muss mit /products/ beginnen und ein Foto sein (.webp/.jpg/.jpeg/.png/.avif).",
    ),
  alt: z.string().trim().min(3, "Alt-Text ist erforderlich.").max(200),
});

export const productImagesSchema = z.object({
  images: z
    .array(productImageSchema)
    .min(MIN_PRODUCT_IMAGES, `Mindestens ${MIN_PRODUCT_IMAGES} Bild ist erforderlich.`)
    .max(MAX_PRODUCT_IMAGES, `Maximal ${MAX_PRODUCT_IMAGES} Bilder sind erlaubt.`)
    .refine(
      (images) => new Set(images.map((image) => image.src)).size === images.length,
      "Bildpfade müssen eindeutig sein.",
    ),
});

export type ProductImagesInput = z.infer<typeof productImagesSchema>;
