"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { MenuCategory } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { COLLECTIONS } from "@/lib/collections";
import { interpolate, label } from "@/lib/i18n";

// Issue #61: the categories and their brand columns come from the catalog type
// configuration (rendered by the server layout) — a new type appears here without a
// code change. Issue #58: the fixed texts come from the translation table; the tile
// renders the first collection (data, like the home hero) with its existing blurb row.
export function MegaMenu({
  categories,
  labels,
}: {
  categories: readonly MenuCategory[];
  labels: Readonly<Record<string, string>>;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div
      className="flex items-center"
      onMouseLeave={() => setOpenCategory(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenCategory(null);
      }}
    >
      {categories.map((category) => {
        const open = openCategory === category.type;
        return (
          <div key={category.type} className="relative" onMouseEnter={() => setOpenCategory(category.type)}>
            <button
              type="button"
              aria-expanded={open}
              aria-haspopup="true"
              onClick={() => setOpenCategory(open ? null : category.type)}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              {category.label}
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute left-0 top-full w-[480px] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      {label(labels, "shop.menu.brands")}
                    </p>
                    <ul className="space-y-1">
                      {category.brands.map((brand) => (
                        <li key={brand}>
                          <Link
                            href={`/products?type=${category.type}&brand=${encodeURIComponent(brand)}`}
                            className="block rounded-md px-2 py-1 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                            onClick={() => setOpenCategory(null)}
                          >
                            {brand}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/products?type=${category.type}`}
                      className="mt-2 block rounded-md px-2 py-1 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => setOpenCategory(null)}
                    >
                      {interpolate(label(labels, "shop.menu.allOfType"), { type: category.label })}
                    </Link>
                  </div>
                  <div className="flex flex-col justify-between rounded-lg bg-muted p-4">
                    <p className="text-sm font-semibold">{COLLECTIONS[0]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {label(labels, `shop.home.blurb.${COLLECTIONS[0]}`)}
                    </p>
                    <Link
                      href={`/products?collection=${encodeURIComponent(COLLECTIONS[0])}`}
                      className="mt-3 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => setOpenCategory(null)}
                    >
                      {label(labels, "shop.home.heroDiscover")}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
