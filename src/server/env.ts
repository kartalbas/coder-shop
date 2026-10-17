import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1).optional(),
  UPS_CLIENT_ID: z.string().min(1).optional(),
  UPS_CLIENT_SECRET: z.string().min(1).optional(),
  UPS_ACCOUNT: z.string().min(1).optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  MONGODB_URI: parsed.MONGODB_URI,
  UPS_CLIENT_ID: parsed.UPS_CLIENT_ID,
  UPS_CLIENT_SECRET: parsed.UPS_CLIENT_SECRET,
  UPS_ACCOUNT: parsed.UPS_ACCOUNT,
  get upsEnabled(): boolean {
    return Boolean(parsed.UPS_CLIENT_ID && parsed.UPS_CLIENT_SECRET && parsed.UPS_ACCOUNT);
  },
};
