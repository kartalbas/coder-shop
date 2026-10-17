import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1).optional(),
  UPS_CLIENT_ID: z.string().min(1).optional(),
  UPS_CLIENT_SECRET: z.string().min(1).optional(),
  UPS_ACCOUNT: z.string().min(1).optional(),
  LLAMA_API_KEY: z.string().min(1).optional(),
  IMAGE_API_URL: z.string().min(1).optional(),
});

const parsed = envSchema.parse(process.env);

export const IMAGE_API_DEFAULT_URL = "http://192.168.10.210:8080/v1/images/generations";

export const env = {
  MONGODB_URI: parsed.MONGODB_URI,
  UPS_CLIENT_ID: parsed.UPS_CLIENT_ID,
  UPS_CLIENT_SECRET: parsed.UPS_CLIENT_SECRET,
  UPS_ACCOUNT: parsed.UPS_ACCOUNT,
  LLAMA_API_KEY: parsed.LLAMA_API_KEY,
  IMAGE_API_URL: parsed.IMAGE_API_URL ?? IMAGE_API_DEFAULT_URL,
  get upsEnabled(): boolean {
    return Boolean(parsed.UPS_CLIENT_ID && parsed.UPS_CLIENT_SECRET && parsed.UPS_ACCOUNT);
  },
};
