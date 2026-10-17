import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalBoolean = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["true", "false"]).optional(),
);

const envSchema = z.object({
  MONGODB_URI: optionalNonEmpty,
  SESSION_SECRET: optionalNonEmpty,
  SESSION_COOKIE_SECURE: optionalBoolean,
  TRUST_PROXY_HEADERS: optionalBoolean,
  UPS_CLIENT_ID: optionalNonEmpty,
  UPS_CLIENT_SECRET: optionalNonEmpty,
  UPS_ACCOUNT: optionalNonEmpty,
  LLAMA_API_KEY: optionalNonEmpty,
  IMAGE_API_URL: optionalNonEmpty,
});

const parsed = envSchema.parse(process.env);

const IMAGE_API_DEFAULT_URL = "http://192.168.10.210:8080/v1/images/generations";

export const env = {
  MONGODB_URI: parsed.MONGODB_URI,
  SESSION_SECRET: parsed.SESSION_SECRET,
  get sessionCookieSecure(): boolean | undefined {
    return parsed.SESSION_COOKIE_SECURE === undefined
      ? undefined
      : parsed.SESSION_COOKIE_SECURE === "true";
  },
  get trustProxyHeaders(): boolean {
    return parsed.TRUST_PROXY_HEADERS === "true";
  },
  UPS_CLIENT_ID: parsed.UPS_CLIENT_ID,
  UPS_CLIENT_SECRET: parsed.UPS_CLIENT_SECRET,
  UPS_ACCOUNT: parsed.UPS_ACCOUNT,
  LLAMA_API_KEY: parsed.LLAMA_API_KEY,
  IMAGE_API_URL: parsed.IMAGE_API_URL ?? IMAGE_API_DEFAULT_URL,
  get upsEnabled(): boolean {
    return Boolean(parsed.UPS_CLIENT_ID && parsed.UPS_CLIENT_SECRET && parsed.UPS_ACCOUNT);
  },
};
