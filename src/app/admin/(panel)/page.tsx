import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen, ShoppingCart } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const instant = false;

export const metadata: Metadata = {
  title: "Admin",
  description: "coder-shop Admin-Bereich.",
};

const SECTIONS = [
  {
    href: "/admin/orders",
    icon: ShoppingCart,
    title: "Bestellungen",
    description: "Statuswechsel protokolliert, Storno mit Lagergutschrift.",
  },
  {
    href: "/admin/packing",
    icon: PackageOpen,
    title: "Kommissionierung",
    description: "Pickliste, Packzettel und UPS-Etiketten.",
  },
];

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Willkommen im coder-shop Admin-Bereich.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
