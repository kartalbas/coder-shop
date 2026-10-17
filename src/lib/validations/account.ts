import { z } from "zod";

// Issue #39: customer account rules. The strength requirement is deliberately modest
// (10 chars, letter + digit) — the UI shows a live hint built from `passwordChecks`.
const MIN_PASSWORD_LENGTH = 10;

export function passwordChecks(password: string): {
  longEnough: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
} {
  return {
    longEnough: password.length >= MIN_PASSWORD_LENGTH,
    hasLetter: /[a-zA-Z]/.test(password),
    hasDigit: /\d/.test(password),
  };
}

export function validateCustomerPassword(password: string): string | null {
  const checks = passwordChecks(password);
  if (!checks.longEnough) return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
  if (!checks.hasLetter || !checks.hasDigit) {
    return "Das Passwort braucht mindestens einen Buchstaben und eine Zahl.";
  }
  return null;
}

export const registerFieldsSchema = z.object({
  name: z.string().trim().min(2, "Bitte Namen angeben").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Bitte gültige E-Mail angeben")),
  password: z.string().refine(
    (password) => validateCustomerPassword(password) === null,
    "Das Passwort braucht mindestens 10 Zeichen, einen Buchstaben und eine Zahl.",
  ),
});

// `consent` is a real boolean — the form action converts the checkbox value before
// handing the payload to the core.
export const registerSchema = registerFieldsSchema.extend({
  consent: z.literal(true, {
    error: "Bitte akzeptieren Sie die AGB, um fortzufahren.",
  }),
});

export const customerLoginSchema = z.object({
  email: z.email("Bitte eine gültige E-Mail eingeben."),
  password: z.string().min(1, "Bitte Passwort eingeben."),
});

export const passwordResetRequestSchema = z.object({
  email: z.email("Bitte gültige E-Mail angeben"),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().refine(
    (password) => validateCustomerPassword(password) === null,
    "Das Passwort braucht mindestens 10 Zeichen, einen Buchstaben und eine Zahl.",
  ),
});

export const addressSchema = z.object({
  label: z.string().trim().min(2, "Bitte Bezeichnung angeben (z. B. Zuhause)").max(60),
  street: z.string().trim().min(3, "Bitte Strasse und Hausnummer angeben").max(120),
  postalCode: z.string().trim().regex(/^\d{4}$/, "Bitte 4-stellige PLZ angeben"),
  city: z.string().trim().min(2, "Bitte Ort angeben").max(80),
  kind: z.enum(["shipping", "billing"]),
  isDefault: z.boolean().default(false),
});

export const addressIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Ungültige Adresse.");

export const claimOrderSchema = z.object({
  orderNumber: z.string().trim().min(4).max(32),
  email: z.email("Bitte gültige E-Mail angeben"),
});

export type AddressInput = z.infer<typeof addressSchema>;
