"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";
import type { SortKey } from "@/lib/validations/listing";

// Issue #58 step 3: the sort options are translation-table texts.
const OPTIONS: { value: SortKey; labelKey: string }[] = [
  { value: "newest", labelKey: "shop.sort.newest" },
  { value: "price-asc", labelKey: "shop.sort.priceAsc" },
  { value: "price-desc", labelKey: "shop.sort.priceDesc" },
  { value: "rating", labelKey: "shop.sort.rating" },
];

export function SortSelect({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  const labels = useLabels();
  return (
    <Select value={value} onValueChange={(next) => onChange(next as SortKey)}>
      <SelectTrigger size="sm" className="w-48" aria-label={label(labels, "shop.listing.sort")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {label(labels, option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
