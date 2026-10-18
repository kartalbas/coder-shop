"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/components/labels";
import { useDebounce } from "@/hooks/use-debounce";
import { label } from "@/lib/i18n";

export function ProductSearch() {
  const labels = useLabels();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const debounced = useDebounce(value, 250);

  useEffect(() => {
    // The URL is the source of truth for the filter — only navigate when it drifts.
    if (debounced === (searchParams.get("q") ?? "")) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debounced) params.set("q", debounced);
    else params.delete("q");
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `/admin/products?${query}` : "/admin/products", { scroll: false });
  }, [debounced, router, searchParams]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={label(labels, "admin.products.searchPlaceholder")}
        aria-label={label(labels, "admin.products.searchAria")}
        className="pl-9"
      />
    </div>
  );
}
