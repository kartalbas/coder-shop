"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ACCOUNT_LINKS = [
  { href: "/konto", label: "Übersicht" },
  { href: "/konto/bestellungen", label: "Bestellungen" },
  { href: "/konto/rechnungen", label: "Rechnungen" },
  { href: "/konto/adressen", label: "Adressen" },
  { href: "/konto/profil", label: "Profil" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Konto-Navigation" className="flex gap-1 overflow-x-auto border-b">
      {ACCOUNT_LINKS.map(({ href, label }) => {
        const active = href === "/konto" ? pathname === "/konto" : pathname.startsWith(href);
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
