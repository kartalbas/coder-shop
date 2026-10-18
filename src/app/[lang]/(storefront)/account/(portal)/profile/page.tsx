export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { AccountLogoutButton } from "@/components/storefront/account-logout-button";
import { CustomerPasswordForm } from "@/components/storefront/customer-password-form";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { getCustomerProfile } from "@/server/customers";
import { requireCustomerSession } from "@/server/session";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/profile">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.profile.title"),
    description: label(labels, "shop.meta.profile.description"),
    robots: { index: false },
  };
}

export default async function ProfilePage({ params }: PageProps<"/[lang]/account/profile">) {
  await connection();
  const userId = await requireCustomerSession();
  const [profile, labels] = await Promise.all([
    getCustomerProfile(userId),
    getLabels((await params).lang),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">{label(labels, "shop.account.profile.accountData")}</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{label(labels, "shop.account.profile.name")}</dt>
              <dd className="font-medium">{profile?.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {label(labels, "shop.checkout.field.email")}
              </dt>
              <dd className="font-medium">{profile?.email}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {label(labels, "shop.account.profile.emailNote")}
          </p>
          <AccountLogoutButton label={label(labels, "shop.action.logout")} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="font-semibold">{label(labels, "shop.account.changePassword")}</h2>
          <CustomerPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
