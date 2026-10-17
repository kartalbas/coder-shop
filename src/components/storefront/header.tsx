"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { MegaMenu } from "./mega-menu";
import { SearchInstant } from "./search-instant";
import { ThemeToggle } from "./theme-toggle";
import { CartButton } from "./cart-button";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold tracking-tight rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          coder-shop
        </Link>
        <nav aria-label="Hauptnavigation" className="hidden md:block">
          <MegaMenu />
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-1 sm:gap-2">
          <SearchInstant />
          <ThemeToggle />
          {/* Issue #39: the portal itself decides between account and login page. */}
          <Link
            href="/konto"
            aria-label="Mein Konto"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <UserRound className="size-5" aria-hidden />
          </Link>
          <CartButton />
        </div>
      </div>
      <nav
        aria-label="Kategorien (mobil)"
        className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden"
      >
        <Link href="/produkte?type=smartphone" className="chip">{PRODUCT_TYPE_LABELS.smartphone}</Link>
        <Link href="/produkte?type=shoes" className="chip">{PRODUCT_TYPE_LABELS.shoes}</Link>
        <Link href="/produkte?type=clothing" className="chip">{PRODUCT_TYPE_LABELS.clothing}</Link>
      </nav>
    </header>
  );
}
