import { z } from "zod";

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
