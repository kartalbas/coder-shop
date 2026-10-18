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
import { getLabels } from "@/server/i18n";
import { interpolate, label } from "@/lib/i18n";

// Issue #58 step 3: metadata texts from the translation table, VAT label interpolated.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/checkout">): Promise<Metadata> {
  await connection();
  const [settings, labels] = await Promise.all([
    getShopSettings(),
    getLabels((await params).lang),
  ]);
  return {
    title: label(labels, "shop.meta.checkout.title"),
    description: interpolate(label(labels, "shop.meta.checkout.description"), {
      vat: vatLabel(settings.vatRatePercent),
    }),
  };
}

export default async function CheckoutPage({ params }: PageProps<"/[lang]/checkout">) {
  await connection();
  // Issue #58 step 3: the page's and the form's texts come from the translation table.
  const labels = await getLabels((await params).lang);
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
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
        {label(labels, "shop.meta.checkout.title")}
      </h1>
      {!profile && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <UserRound className="size-4" aria-hidden />
            {label(labels, "shop.checkout.guestQuestion")}
          </span>
          <Link
            href="/account/login?next=%2Fcheckout"
            className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {label(labels, "shop.action.login")}
          </Link>
          <span className="text-muted-foreground">{label(labels, "shop.checkout.or")}</span>
          <Link
            href="/account/register"
            className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {label(labels, "shop.action.register")}
          </Link>
          <span className="text-muted-foreground">{label(labels, "shop.checkout.guestHint")}</span>
        </div>
      )}
      <CheckoutForm prefill={prefill} invoiceAvailable={invoiceAvailable} labels={labels} />
    </div>
  );
}
