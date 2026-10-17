export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { AccountLogoutButton } from "@/components/storefront/account-logout-button";
import { CustomerPasswordForm } from "@/components/storefront/customer-password-form";
import { getCustomerProfile } from "@/server/customers";
import { requireCustomerSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Mein Profil",
  description: "Kontodaten und Passwort — coder-shop.",
  robots: { index: false },
};

export default async function ProfilePage() {
  await connection();
  const userId = await requireCustomerSession();
  const profile = await getCustomerProfile(userId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">Kontodaten</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{profile?.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">E-Mail</dt>
              <dd className="font-medium">{profile?.email}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Die E-Mail-Adresse ist der Schlüssel zu Ihren Bestellungen — eine Änderung ist
            in dieser Demo nicht vorgesehen.
          </p>
          <AccountLogoutButton />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">Passwort ändern</h2>
          <CustomerPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
