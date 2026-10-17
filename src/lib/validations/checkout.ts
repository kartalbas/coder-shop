import { z } from "zod";

export const shippingMethods = ["standard", "express"] as const;
export type ShippingMethodParam = (typeof shippingMethods)[number];

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(2, "Bitte Namen angeben").max(100),
  email: z.email("Bitte gültige E-Mail angeben"),
  phone: z
    .string()
    .trim()
    .min(6, "Bitte gültige Telefonnummer angeben")
    .max(30)
    .regex(/^[+\d][\d\s/() .-]*$/, "Bitte gültige Telefonnummer angeben"),
  street: z.string().trim().min(3, "Bitte Strasse und Hausnummer angeben").max(120),
  postalCode: z.string().trim().regex(/^\d{4}$/, "Bitte 4-stellige PLZ angeben"),
  city: z.string().trim().min(2, "Bitte Ort angeben").max(80),
  country: z.string().trim().length(2).toUpperCase().default("CH"),
});

// Anti-abuse limits (issue #8): a real basket is small; a scripted drain sends many
// distinct SKUs at max quantity. Per-SKU merging in createOrderCore closes the
// "same SKU in several lines" loophole, these caps bound a single order.
export const MAX_CHECKOUT_LINES = 20;
export const MAX_QTY_PER_LINE = 10;
export const MAX_QTY_PER_SKU = 10;

export const checkoutLineSchema = z.object({
  sku: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const checkoutSchema = z
  .object({
    lines: z.array(checkoutLineSchema).min(1, "Der Warenkorb ist leer").max(MAX_CHECKOUT_LINES),
    customer: checkoutCustomerSchema,
    shippingMethod: z.enum(shippingMethods),
  })
  .refine(
    (data) => {
      const bySku = new Map<string, number>();
      for (const line of data.lines) bySku.set(line.sku, (bySku.get(line.sku) ?? 0) + line.qty);
      return [...bySku.values()].every((qty) => qty <= MAX_QTY_PER_SKU);
    },
    { message: `Maximal ${MAX_QTY_PER_SKU} Stück pro Artikel.`, path: ["lines"] },
  );

export type CheckoutCustomer = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
