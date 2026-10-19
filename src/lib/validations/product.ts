import { z } from "zod";
import { label, interpolate, LANGUAGE_CODE_PATTERN, type LabelMap } from "@/lib/i18n";
import { isPhotoSrc } from "@/lib/images";

// Issue #58 step 3: the messages come from the translation table in the request
// language — the cores build these schemas through the factories below (the
// account.ts pattern), so validation refusals answer like every other message.

export function createProductCoreSchema(labels: LabelMap) {
  return z.object({
    name: z.string().trim().min(2, label(labels, "admin.products.validation.nameRequired")).max(120),
    description: z
      .string()
      .trim()
      .min(10, label(labels, "admin.products.validation.descriptionRequired"))
      .max(2000),
    brand: z.string().trim().min(1, label(labels, "admin.products.validation.brandRequired")).max(60),
    priceCents: z.coerce.number().int(label(labels, "admin.validation.wholeCents")).min(0),
  });
}

// Issue #58 step B2: the product form's translation section sends one payload with a
// per-language name and description. Texts may be blank (that clears the text — the
// document base shows through again); the language codes themselves are validated
// against the language rows by `saveTranslationCore`.
export function createProductContentSchema(labels: LabelMap) {
  return z.object({
    texts: z.record(
      z.string().regex(LANGUAGE_CODE_PATTERN, label(labels, "admin.error.invalidRequest")),
      z.object({
        name: z.string().trim().max(120),
        description: z.string().trim().max(2000),
      }),
    ),
  });
}

// Issue #61: variant attributes are a generic record keyed by the catalog type's
// dimension keys — which keys must be present (and what they mean) is validated
// against the type configuration in `updateVariantCore`, not here.
function variantAttributeValueSchema(labels: LabelMap) {
  return z.union([
    z.string().trim().min(1, label(labels, "admin.validation.valueRequired")).max(60),
    z.number(),
  ]);
}

export function createVariantCoreSchema(labels: LabelMap) {
  return z.object({
    priceDeltaCents: z
      .coerce
      .number()
      .int(label(labels, "admin.validation.wholeCents"))
      .min(-100000)
      .max(100000),
    stock: z.coerce.number().int(label(labels, "admin.validation.wholeQuantity")).min(0),
    // Stock the editor loaded; a stock edit is only applied while the DB still has it (issue #13).
    expectedStock: z.coerce.number().int().min(0),
    weightGrams: z
      .coerce
      .number()
      .int(label(labels, "admin.validation.wholeGrams"))
      .min(1)
      .max(100000),
    attributes: z.record(z.string().min(1).max(60), variantAttributeValueSchema(labels)),
  });
}

export const MIN_PRODUCT_IMAGES = 1;
export const MAX_PRODUCT_IMAGES = 5;

function productImageSchema(labels: LabelMap) {
  return z.object({
    src: z
      .string()
      .trim()
      .min(1, label(labels, "admin.images.validation.pathRequired"))
      .max(300)
      .refine(
        (src) => src.startsWith("/products/") && isPhotoSrc(src),
        label(labels, "admin.images.validation.pathShape"),
      ),
    alt: z.string().trim().min(3, label(labels, "admin.images.validation.altRequired")).max(200),
  });
}

export function createProductImagesSchema(labels: LabelMap) {
  return z.object({
    images: z
      .array(productImageSchema(labels))
      .min(
        MIN_PRODUCT_IMAGES,
        interpolate(label(labels, "admin.images.validation.min"), { min: MIN_PRODUCT_IMAGES }),
      )
      .max(
        MAX_PRODUCT_IMAGES,
        interpolate(label(labels, "admin.images.validation.max"), { max: MAX_PRODUCT_IMAGES }),
      )
      .refine(
        (images) => new Set(images.map((image) => image.src)).size === images.length,
        label(labels, "admin.images.validation.unique"),
      ),
  });
}
