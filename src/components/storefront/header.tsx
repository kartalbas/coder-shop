"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { MegaMenu } from "./mega-menu";
import { SearchInstant } from "./search-instant";
import { ThemeToggle } from "./theme-toggle";
import { CartButton } from "./cart-button";
import { LanguageSwitcher } from "./language-switcher";
import type { MenuCategory } from "@/lib/menu";
import { label, type LanguageConfig } from "@/lib/i18n";

// Issue #61: the category navigation is rendered from the catalog type configuration.
// Issue #58: the language switcher is rendered from the language rows; since step 3
// every fixed text is a translation-table label of the request language.
export function Header({
  categories,
  languages,
  labels,
}: {
  categories: readonly MenuCategory[];
  languages: readonly LanguageConfig[];
  labels: Readonly<Record<string, string>>;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold tracking-tight rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          coder-shop
        </Link>
        <nav aria-label={label(labels, "shop.header.nav.main")} className="hidden md:block">
          <MegaMenu categories={categories} />
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-1 sm:gap-2">
          <SearchInstant />
          <LanguageSwitcher languages={languages} />
          <ThemeToggle />
          {/* Issue #39: the portal itself decides between account and login page. */}
          <Link
            href="/account"
            aria-label={label(labels, "shop.header.account")}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <UserRound className="size-5" aria-hidden />
          </Link>
          <CartButton />
        </div>
      </div>
      <nav
        aria-label={label(labels, "shop.header.nav.categories")}
        className={categories.length > 0 ? "flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden" : "hidden"}
      >
        {categories.map((category) => (
          <Link
            key={category.type}
            href={`/products?type=${encodeURIComponent(category.type)}`}
            className="chip"
          >
            {category.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
