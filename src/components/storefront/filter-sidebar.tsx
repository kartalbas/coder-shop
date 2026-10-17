"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FacetCounts, FacetValue } from "@/server/search";

export type FacetKey = "brand" | "size" | "color" | "storage" | "material";

const GROUPS: { key: FacetKey; label: string; values: (f: FacetCounts) => FacetValue[] }[] = [
  { key: "brand", label: "Marke", values: (f) => f.brand },
  { key: "size", label: "Grösse", values: (f) => f.sizes },
  { key: "color", label: "Farbe", values: (f) => f.colors },
  { key: "storage", label: "Speicher", values: (f) => f.storage },
  { key: "material", label: "Material", values: (f) => f.materials },
];

interface Props {
  facets: FacetCounts;
  selected: Partial<Record<FacetKey, string>>;
  onToggle: (key: FacetKey, value: string) => void;
}

export function FilterSidebar({ facets, selected, onToggle }: Props) {
  const groups = GROUPS.map((group) => ({ ...group, values: group.values(facets) })).filter(
    (group) => group.values.length > 0,
  );
  if (groups.length === 0) return null;

  return (
    <aside aria-label="Filter" className="space-y-6">
      {groups.map((group) => (
        <fieldset key={group.key}>
          <legend className="mb-2 text-sm font-semibold">{group.label}</legend>
          <ul className="space-y-1.5">
            {group.values.map((facet) => {
              const id = `facet-${group.key}-${facet.value}`;
              const checked = selected[group.key] === facet.value;
              return (
                <li key={facet.value} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => onToggle(group.key, facet.value)}
                  />
                  <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                    {group.key === "storage" ? `${facet.value} GB` : facet.value}
                  </Label>
                  <span className="text-xs text-muted-foreground">{facet.count}</span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </aside>
  );
}
