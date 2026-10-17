export const instant = false;

import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, MapPin, Package, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AccountLogoutButton } from "@/components/storefront/account-logout-button";
import { listAccountOrders } from "@/server/account";
import { getCustomerProfile } from "@/server/customers";
import { requireCustomerSession } from "@/server/session";

const SECTIONS = [
  {
    href: "/konto/bestellungen",
    icon: Package,
    title: "Bestellungen",
    text: "Bestellhistorie mit Status, Sendungsverfolgung und „Erneut bestellen“.",
  },
  {
    href: "/konto/adressen",
    icon: MapPin,
    title: "Adressen",
    text: "Liefer- und Rechnungsadressen verwalten.",
  },
  {
    href: "/konto/profil",
    icon: UserRound,
    title: "Profil",
    text: "Name, E-Mail und Passwort ändern.",
  },
];

export default async function AccountOverviewPage() {
  await connection();
  const userId = await requireCustomerSession();
  const [profile, orders] = await Promise.all([
    getCustomerProfile(userId),
    listAccountOrders(userId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Angemeldet als <span className="font-medium text-foreground">{profile?.email}</span>
        </p>
        <AccountLogoutButton />
      </div>

      <p className="text-sm">
        {orders.length === 0
          ? "Sie haben noch keine Bestellungen in Ihrem Konto."
          : `${orders.length} ${orders.length === 1 ? "Bestellung" : "Bestellungen"} in Ihrem Konto.`}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, icon: Icon, title, text }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border bg-card transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Card className="h-full border-0 shadow-none">
              <CardContent className="flex h-full flex-col gap-2 p-5">
                <Icon className="size-5 text-primary" aria-hidden />
                <span className="flex items-center gap-1 font-medium">
                  {title}
                  <ArrowRight
                    className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
