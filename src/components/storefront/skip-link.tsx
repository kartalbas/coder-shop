"use client";

import { label } from "@/lib/i18n";
import { useLabels } from "./labels";

// Issue #58 step 3: the skip link is a client component so its text comes from the
// label context — the provider's seed-config initial value keeps it in the static
// shell, the LabelsSync hole follows the live table.
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md focus:outline-2 focus:outline-ring"
    >
      {label(useLabels(), "shop.skip")}
    </a>
  );
}
