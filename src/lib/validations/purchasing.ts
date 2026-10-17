import { z } from "zod";

export const supplierInputSchema = z.object({
  name: z.string().trim().min(2, "Name ist erforderlich."),
  email: z.email("Gültige E-Mail erforderlich."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => (value ? value : undefined)),
  leadTimeDays: z.coerce.number().int("Ganze Tage erforderlich.").min(0).max(365),
  active: z.coerce.boolean(),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;

export const poLineInputSchema = z.object({
  sku: z.string().trim().min(1, "SKU ist erforderlich."),
  qty: z.coerce.number().int().min(1, "Mindestens 1 Stück.").max(10000),
  unitPriceCents: z.coerce.number().int().min(0),
});

export type PoLineInput = z.infer<typeof poLineInputSchema>;

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Lieferant ist erforderlich."),
  lines: z
    .array(poLineInputSchema)
    .min(1, "Mindestens eine Position ist erforderlich.")
    .max(50)
    .refine(
      (lines) => new Set(lines.map((line) => line.sku)).size === lines.length,
      "Jede SKU darf nur einmal vorkommen.",
    ),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
