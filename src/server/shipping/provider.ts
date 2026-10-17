import { env } from "../env";
import type { ShippingProvider } from "@/lib/shipping/types";
import { MockUpsProvider } from "./mock";
import { UpsShippingProvider } from "./ups";

export function getShippingProvider(): ShippingProvider {
  if (env.upsEnabled) {
    return new UpsShippingProvider({
      clientId: env.UPS_CLIENT_ID as string,
      clientSecret: env.UPS_CLIENT_SECRET as string,
      accountNumber: env.UPS_ACCOUNT as string,
    });
  }
  return new MockUpsProvider();
}
