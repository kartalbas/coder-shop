import { z } from "zod";

// Issue #64: shipping and payment methods are configuration rows — the schema only
// bounds the key shape; `createOrderCore` validates the keys against the active
// configuration (existence, active, kind/shipping combination).
const methodKeySchema = z.string().trim().min(1).max(32).regex(/^[a-z][a-z0-9-]*$/);

const checkoutCustomerSchema = z.object({
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

const checkoutLineSchema = z.object({
  sku: z.string().min(1).max(64),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  // The unit price the checkout page showed the customer (issue #12). The server books
  // current database prices and refuses the order if they differ — the customer must
  // never be charged something other than what was displayed.
  expectedUnitPriceCents: z.number().int().min(0).max(100_000_000),
});

export const checkoutSchema = z
  .object({
    lines: z.array(checkoutLineSchema).min(1, "Der Warenkorb ist leer").max(MAX_CHECKOUT_LINES),
    customer: checkoutCustomerSchema,
    shippingMethod: methodKeySchema,
    // Issue #40: invoice-type payment is only honored for a logged-in customer within
    // their credit limit — that is a server decision; the schema only bounds the key.
    paymentMethod: methodKeySchema.default("mock"),
    // Issue #45: the code is validated and redeemed server-side inside the transaction.
    discountCode: z.string().trim().max(32).optional(),
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
