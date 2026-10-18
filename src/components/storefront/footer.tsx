"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { interpolate, label } from "@/lib/i18n";
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
// Issue #58 step 3: every fixed text is a translation-table label of the request
// language; the VAT label and the year fill the text's placeholders.
export function Footer({
  categories,
  vatLabelText,
  labels,
}: {
  categories: readonly MenuCategory[];
  vatLabelText: string;
  labels: Readonly<Record<string, string>>;
}) {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">coder-shop</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {interpolate(label(labels, "shop.footer.tagline"), { vat: vatLabelText })}
          </p>
        </div>
        <nav aria-label={label(labels, "shop.footer.assortment")}>
          <p className="text-sm font-semibold">{label(labels, "shop.footer.assortment")}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {categories.map((category) => (
              <li key={category.type}>
                <Link
                  className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  href={`/products?type=${encodeURIComponent(category.type)}`}
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold">{label(labels, "shop.footer.service")}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>{label(labels, "shop.footer.shipping")}</li>
            <li>{label(labels, "shop.footer.payment")}</li>
            <li>{label(labels, "shop.footer.returns")}</li>
          </ul>
        </div>
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">
        © <CurrentYear /> {label(labels, "shop.footer.copyright")}
      </p>
    </footer>
  );
}
