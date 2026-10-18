import { z } from "zod";
import { interpolate, label } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH, passwordRuleChecks } from "@/lib/password-rules";

// Issue #39: customer account rules. The strength requirement is deliberately modest
// (10 chars, letter + digit) — the rules themselves live in `src/lib/password-rules.ts`
// so the live checklist (issue #60) and the server enforce exactly the same ones.
// Issue #58 step 3 (server-messages slice): the message is a translation-table row
// (`{min}` is MIN_PASSWORD_LENGTH), the rule stays the pure test.
export function validateCustomerPassword(
  password: string,
  labels: Readonly<Record<string, string>>,
): string | null {
  const checks = passwordRuleChecks("customer", password);
  if (!checks.longEnough) {
    return interpolate(label(labels, "shop.validation.password.length"), {
      min: MIN_PASSWORD_LENGTH,
    });
  }
  if (!checks.hasLetter || !checks.hasDigit) {
    return interpolate(label(labels, "shop.validation.password.letterDigit"), {
      min: MIN_PASSWORD_LENGTH,
    });
  }
  return null;
}

function passwordSchema(labels: Readonly<Record<string, string>>) {
  return z.string().refine(
    (password) => validateCustomerPassword(password, labels) === null,
    interpolate(label(labels, "shop.validation.password"), { min: MIN_PASSWORD_LENGTH }),
  );
}

// The schemas are factories over the request language's label map (#58 server-messages
// slice) — validation behaviour unchanged, only the messages follow the language. The
// German bases are byte-identical to the literals these schemas carried.
export function createRegisterFieldsSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    name: z.string().trim().min(2, label(labels, "shop.validation.field.name")).max(100),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email(label(labels, "shop.validation.field.email"))),
    password: passwordSchema(labels),
  });
}

// `consent` is a real boolean — the form action converts the checkbox value before
// handing the payload to the core.
export function createRegisterSchema(labels: Readonly<Record<string, string>>) {
  return createRegisterFieldsSchema(labels).extend({
    consent: z.literal(true, {
      error: label(labels, "shop.validation.field.consent"),
    }),
  });
}

export function createCustomerLoginSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    email: z.email(label(labels, "shop.validation.field.loginEmail")),
    password: z.string().min(1, label(labels, "shop.validation.field.loginPassword")),
  });
}

export function createPasswordResetRequestSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    email: z.email(label(labels, "shop.validation.field.email")),
  });
}

export function createPasswordResetConfirmSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    token: z.string().min(10).max(200),
    password: passwordSchema(labels),
  });
}

export function createAddressSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    label: z
      .string()
      .trim()
      .min(2, label(labels, "shop.validation.field.addressLabel"))
      .max(60),
    street: z
      .string()
      .trim()
      .min(3, label(labels, "shop.validation.field.street"))
      .max(120),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{4}$/, label(labels, "shop.validation.field.postalCode")),
    city: z.string().trim().min(2, label(labels, "shop.validation.field.city")).max(80),
    kind: z.enum(["shipping", "billing"]),
    isDefault: z.boolean().default(false),
  });
}

export function createAddressIdSchema(labels: Readonly<Record<string, string>>) {
  return z
    .string()
    .regex(/^[a-f\d]{24}$/i, label(labels, "shop.validation.field.addressId"));
}

export function createClaimOrderSchema(labels: Readonly<Record<string, string>>) {
  return z.object({
    orderNumber: z.string().trim().min(4).max(32),
    email: z.email(label(labels, "shop.validation.field.email")),
  });
}

export type AddressInput = z.infer<ReturnType<typeof createAddressSchema>>;
