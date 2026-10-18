export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { AddressBook } from "@/components/storefront/address-book";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { getCustomerProfile } from "@/server/customers";
import { requireCustomerSession } from "@/server/session";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/addresses">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.addresses.title"),
    description: label(labels, "shop.meta.addresses.description"),
    robots: { index: false },
  };
}

export default async function AddressesPage({ params }: PageProps<"/[lang]/account/addresses">) {
  await connection();
  const userId = await requireCustomerSession();
  const [profile, labels] = await Promise.all([
    getCustomerProfile(userId),
    getLabels((await params).lang),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{label(labels, "shop.account.addresses.title")}</h2>
      <AddressBook addresses={profile?.addresses ?? []} />
    </div>
  );
}
