import { z } from "zod";

// Mongo ObjectIds cross the client/server boundary in forms and paths; anything else is
// bad input to be rejected with a validation error, not a 500 from mongoose.
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Ungültige Anfrage.");

// Issue #60: form errors belong at the field they came from — map each zod issue to the
// message of its first path segment so actions can return per-field errors.
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
