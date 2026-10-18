"use client";

import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";

export function EmptyState({ onReset }: { onReset: () => void }) {
  const labels = useLabels();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <PackageSearch className="size-10 text-muted-foreground" />
      <p className="font-medium">{label(labels, "shop.listing.emptyTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{label(labels, "shop.listing.emptyBody")}</p>
      <Button variant="outline" onClick={onReset}>
        {label(labels, "shop.listing.resetFilters")}
      </Button>
    </div>
  );
}
