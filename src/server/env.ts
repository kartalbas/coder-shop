import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalBoolean = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["true", "false"]).optional(),
);

const optionalPositiveInt = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
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
  SMTP_HOST: optionalNonEmpty,
  SMTP_PORT: optionalNonEmpty,
  SMTP_USER: optionalNonEmpty,
  SMTP_PASSWORD: optionalNonEmpty,
  SMTP_FROM: optionalNonEmpty,
  CUSTOMER_REGISTER_LIMIT_PER_HOUR: optionalPositiveInt,
});

const parsed = envSchema.parse(process.env);

const IMAGE_API_DEFAULT_URL = "http://192.168.10.210:8080/v1/images/generations";
const REGISTER_LIMIT_DEFAULT = 5;

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
  SMTP_HOST: parsed.SMTP_HOST,
  SMTP_PORT: parsed.SMTP_PORT,
  SMTP_USER: parsed.SMTP_USER,
  SMTP_PASSWORD: parsed.SMTP_PASSWORD,
  SMTP_FROM: parsed.SMTP_FROM,
  // Issue #58: the abuse limit stays a configuration, not a code constant — production
  // keeps the conservative default, the e2e suite raises it for its own server.
  get customerRegisterLimitPerHour(): number {
    return parsed.CUSTOMER_REGISTER_LIMIT_PER_HOUR ?? REGISTER_LIMIT_DEFAULT;
  },
  // Issue #44: real delivery only when host and sender are configured;
  // otherwise every mail stays in the dev outbox.
  get smtpEnabled(): boolean {
    return Boolean(parsed.SMTP_HOST && parsed.SMTP_FROM);
  },
};
