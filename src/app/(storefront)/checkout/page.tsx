export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { UserRound } from "lucide-react";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { vatLabel } from "@/lib/shop-settings";
import { getCustomerProfile } from "@/server/customers";
import { getCreditLimitCents, getInvoiceCreditUsageCents } from "@/server/invoices";
import { getCustomerSessionUserId } from "@/server/session";
import { getShopSettings } from "@/server/shop-settings";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const settings = await getShopSettings();
  return {
    title: "Kasse",
    description: `Adresse, Versand und Zahlung — coder-shop. Preise in CHF inklusive ${vatLabel(settings.vatRatePercent)}`,
  };
}

export default async function CheckoutPage() {
  await connection();
  // Issue #39: logged in? the form starts from the profile and default address.
  const userId = await getCustomerSessionUserId();
  const profile = userId ? await getCustomerProfile(userId) : null;
  // Issue #40: „Rechnung“ is offered when the account exists and its credit is not yet
  // exhausted; createOrderCore re-checks the exact amount inside the transaction.
  const invoiceAvailable = userId
    ? (await getInvoiceCreditUsageCents(userId)) < (await getCreditLimitCents(userId))
    : false;
  const defaultAddress = profile?.addresses.find(
    (address) => address.kind === "shipping" && address.isDefault,
  );
  const prefill = profile
    ? {
        name: profile.name,
        email: profile.email,
        street: defaultAddress?.street ?? "",
        postalCode: defaultAddress?.postalCode ?? "",
        city: defaultAddress?.city ?? "",
      }
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Kasse</h1>
      {!profile && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <UserRound className="size-4" aria-hidden />
            Sie haben bereits ein Konto?
          </span>
          <Link
            href="/konto/anmelden?next=%2Fkasse"
            className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Anmelden
          </Link>
          <span className="text-muted-foreground">oder</span>
          <Link
            href="/konto/registrieren"
            className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Konto erstellen
          </Link>
          <span className="text-muted-foreground">— oder als Gast bestellen.</span>
        </div>
      )}
      <CheckoutForm prefill={prefill} invoiceAvailable={invoiceAvailable} />
    </div>
  );
}
