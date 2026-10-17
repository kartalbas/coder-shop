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

export const checkoutLineSchema = z.object({
  sku: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(100),
});

export const checkoutSchema = z.object({
  lines: z.array(checkoutLineSchema).min(1, "Der Warenkorb ist leer").max(50),
  customer: checkoutCustomerSchema,
  shippingMethod: z.enum(shippingMethods),
});

export type CheckoutCustomer = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutLine = z.infer<typeof checkoutLineSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function checkoutPayloadError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}
