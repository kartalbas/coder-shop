export const instant = false;

import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, MapPin, Package, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AccountLogoutButton } from "@/components/storefront/account-logout-button";
import { interpolate, label, plural } from "@/lib/i18n";
import { getIntlLocale, getLabels } from "@/server/i18n";
import { listAccountOrders } from "@/server/account";
import { getCustomerProfile } from "@/server/customers";
import { requireCustomerSession } from "@/server/session";

// Issue #58 step 3: the section titles reuse the account-nav keys, the descriptions are
// their own rows — all translation-table texts.
const SECTIONS = [
  {
    href: "/account/orders",
    icon: Package,
    titleKey: "shop.account.nav.orders",
    textKey: "shop.account.section.orders.text",
  },
  {
    href: "/account/addresses",
    icon: MapPin,
    titleKey: "shop.account.nav.addresses",
    textKey: "shop.account.section.addresses.text",
  },
  {
    href: "/account/profile",
    icon: UserRound,
    titleKey: "shop.account.nav.profile",
    textKey: "shop.account.section.profile.text",
  },
];

export default async function AccountOverviewPage({ params }: PageProps<"/[lang]/account">) {
  await connection();
  const lang = (await params).lang;
  const userId = await requireCustomerSession();
  const [profile, orders, labels, intlLocale] = await Promise.all([
    getCustomerProfile(userId),
    listAccountOrders(userId),
    getLabels(lang),
    getIntlLocale(lang),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          {label(labels, "shop.account.signedInAs")}{" "}
          <span className="font-medium text-foreground">{profile?.email}</span>
        </p>
        <AccountLogoutButton label={label(labels, "shop.action.logout")} />
      </div>

      <p className="text-sm">
        {orders.length === 0
          ? label(labels, "shop.account.noOrders")
          : interpolate(plural(labels, orders.length, "shop.account.orderCount", intlLocale), {
              count: orders.length,
            })}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, icon: Icon, titleKey, textKey }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Card className="h-full border-0 shadow-none">
              <CardContent className="flex h-full flex-col gap-2 p-5">
                <Icon className="size-5 text-primary" aria-hidden />
                <span className="flex items-center gap-1 font-medium">
                  {label(labels, titleKey)}
                  <ArrowRight
                    className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
                <span className="text-sm text-muted-foreground">{label(labels, textKey)}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
