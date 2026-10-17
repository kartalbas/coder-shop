"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ACCOUNT_LINKS = [
  { href: "/account", label: "Übersicht" },
  { href: "/account/orders", label: "Bestellungen" },
  { href: "/account/invoices", label: "Rechnungen" },
  { href: "/account/wishlist", label: "Wunschliste" },
  { href: "/account/addresses", label: "Adressen" },
  { href: "/account/profile", label: "Profil" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Konto-Navigation" className="flex gap-1 overflow-x-auto border-b">
      {ACCOUNT_LINKS.map(({ href, label }) => {
        const active = href === "/account" ? pathname === "/account" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              active && "border-primary text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
