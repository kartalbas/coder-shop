export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { AddressBook } from "@/components/storefront/address-book";
import { getCustomerProfile } from "@/server/customers";
import { requireCustomerSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Meine Adressen",
  description: "Liefer- und Rechnungsadressen — coder-shop.",
  robots: { index: false },
};

export default async function AddressesPage() {
  await connection();
  const userId = await requireCustomerSession();
  const profile = await getCustomerProfile(userId);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Adressbuch</h2>
      <AddressBook addresses={profile?.addresses ?? []} />
    </div>
  );
}
