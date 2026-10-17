import { z } from "zod";

// Mongo ObjectIds cross the client/server boundary in forms and paths; anything else is
// bad input to be rejected with a validation error, not a 500 from mongoose.
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Ungültige Anfrage.");
