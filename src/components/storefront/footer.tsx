"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";
import { VAT_LABEL } from "@/lib/pricing";

const noSubscribe = () => () => {};

function CurrentYear() {
  const year = useSyncExternalStore(
    noSubscribe,
    () => new Date().getFullYear(),
    () => null,
  );
  return <>{year}</>;
}

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">coder-shop</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Premium-Technik, Schuhe und Kleidung. Alle Preise in CHF inklusive {VAT_LABEL}.
          </p>
        </div>
        <nav aria-label="Footer Navigation">
          <p className="text-sm font-semibold">Sortiment</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link className="hover:underline focus-visible:outline-2 focus-visible:outline-ring" href="/produkte?type=smartphone">{PRODUCT_TYPE_LABELS.smartphone}</Link></li>
            <li><Link className="hover:underline focus-visible:outline-2 focus-visible:outline-ring" href="/produkte?type=shoes">{PRODUCT_TYPE_LABELS.shoes}</Link></li>
            <li><Link className="hover:underline focus-visible:outline-2 focus-visible:outline-ring" href="/produkte?type=clothing">{PRODUCT_TYPE_LABELS.clothing}</Link></li>
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
