"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { label } from "@/lib/i18n";
import { useLabels } from "@/components/storefront/labels";
import { cn } from "@/lib/utils";

// Issue #58 step 3: the labels are translation-table keys, resolved per request language.
const ACCOUNT_LINKS = [
  { href: "/account", labelKey: "shop.account.nav.overview" },
  { href: "/account/orders", labelKey: "shop.account.nav.orders" },
  { href: "/account/invoices", labelKey: "shop.account.nav.invoices" },
  { href: "/account/wishlist", labelKey: "shop.account.nav.wishlist" },
  { href: "/account/addresses", labelKey: "shop.account.nav.addresses" },
  { href: "/account/profile", labelKey: "shop.account.nav.profile" },
];

export function AccountNav() {
  const labels = useLabels();
  const pathname = usePathname();
  return (
    <nav aria-label={label(labels, "shop.account.nav.aria")} className="flex gap-1 overflow-x-auto border-b">
      {ACCOUNT_LINKS.map(({ href, labelKey }) => {
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
            {label(labels, labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
