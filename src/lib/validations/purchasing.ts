import { z } from "zod";
import { label } from "@/lib/i18n";

// Issue #58 step 4: the messages are translation-table rows resolved for the request
// language, so the schemas are label-map factories (same pattern as the checkout and
// account schemas).

export function createSupplierInputSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    name: z.string().trim().min(2, label(labels, "admin.supplier.error.nameRequired")),
    email: z.email(label(labels, "admin.supplier.error.emailInvalid")),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((value) => (value ? value : undefined)),
    leadTimeDays: z.coerce
      .number()
      .int(label(labels, "admin.supplier.error.leadInt"))
      .min(0)
      .max(365),
    active: z.boolean(),
  });
}

export type SupplierInput = z.infer<ReturnType<typeof createSupplierInputSchema>>;

export function createPurchaseOrderSchemaFactory(labels: Readonly<Record<string, string>>) {
  const poLineInputSchema = z.object({
    sku: z.string().trim().min(1, label(labels, "admin.po.error.skuRequired")),
    qty: z.coerce
      .number()
      .int()
      .min(1, label(labels, "admin.po.error.qtyMin"))
      .max(10000),
    unitPriceCents: z.coerce.number().int().min(0),
  });

  return z.object({
    supplierId: z.string().min(1, label(labels, "admin.po.error.supplierRequired")),
    lines: z
      .array(poLineInputSchema)
      .min(1, label(labels, "admin.po.error.linesMin"))
      .max(50)
      .refine(
        (lines) => new Set(lines.map((line) => line.sku)).size === lines.length,
        label(labels, "admin.po.error.skuDuplicate"),
      ),
  });
}
