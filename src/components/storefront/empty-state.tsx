"use client";

import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <PackageSearch className="size-10 text-muted-foreground" />
      <p className="font-medium">Keine Produkte gefunden</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Für diese Filterkombination gibt es keine Treffer. Versuchen Sie, Filter zu entfernen.
      </p>
      <Button variant="outline" onClick={onReset}>
        Filter zurücksetzen
      </Button>
    </div>
  );
}
