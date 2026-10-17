"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { MenuCategory } from "@/lib/menu";

const noSubscribe = () => () => {};

function CurrentYear() {
  const year = useSyncExternalStore(
    noSubscribe,
    () => new Date().getFullYear(),
    () => null,
  );
  return <>{year}</>;
}

// Issue #61: the assortment links follow the catalog type configuration.
// Issue #64: the VAT wording is configured data, passed in by the server slot.
export function Footer({
  categories,
  vatLabelText,
}: {
  categories: readonly MenuCategory[];
  vatLabelText: string;
}) {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">coder-shop</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Premium-Technik, Schuhe und Kleidung. Alle Preise in CHF inklusive {vatLabelText}
          </p>
        </div>
        <nav aria-label="Footer Navigation">
          <p className="text-sm font-semibold">Sortiment</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {categories.map((category) => (
              <li key={category.type}>
                <Link
                  className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  href={`/produkte?type=${encodeURIComponent(category.type)}`}
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold">Service</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Versand aus der Schweiz</li>
            <li>Zahlung in CHF</li>
            <li>14 Tage Rückgaberecht</li>
          </ul>
        </div>
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">
        © <CurrentYear /> coder-shop — Demo-Shop
      </p>
    </footer>
  );
}
