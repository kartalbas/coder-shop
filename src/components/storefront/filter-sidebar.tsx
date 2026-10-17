"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { isNumericFacetValue } from "@/lib/facet-order";
import type { FacetCounts, FacetValue } from "@/server/search";

export type FacetKey = "brand" | "size" | "color" | "storage" | "material";

interface Group {
  key: FacetKey;
  label: string;
  values: FacetValue[];
}

// Issue #24: under "Alle" the size facet must not mix EU sizes with XS–XXL — they become
// two groups. Values are disjoint, so both still write the `size` param.
function buildGroups(facets: FacetCounts): Group[] {
  const euSizes = facets.sizes.filter((v) => isNumericFacetValue(v.value));
  const letterSizes = facets.sizes.filter((v) => !isNumericFacetValue(v.value));
  const bothSizeKinds = euSizes.length > 0 && letterSizes.length > 0;

  const groups: Group[] = [
    { key: "brand", label: "Marke", values: facets.brand },
    bothSizeKinds
      ? { key: "size", label: "Grösse (EU)", values: euSizes }
      : { key: "size", label: "Grösse", values: facets.sizes },
  ];
  if (bothSizeKinds) groups.push({ key: "size", label: "Grösse (Kleider)", values: letterSizes });
  groups.push(
    { key: "color", label: "Farbe", values: facets.colors },
    { key: "storage", label: "Speicher", values: facets.storage },
    { key: "material", label: "Material", values: facets.materials },
  );
  return groups.filter((group) => group.values.length > 0);
}

interface Props {
  facets: FacetCounts;
  selected: Partial<Record<FacetKey, string[]>>;
  onToggle: (key: FacetKey, value: string) => void;
}

export function FilterSidebar({ facets, selected, onToggle }: Props) {
  const groups = buildGroups(facets);
  if (groups.length === 0) return null;

  return (
    <aside aria-label="Filter" className="space-y-6">
      {groups.map((group) => (
        <fieldset key={`${group.key}-${group.label}`}>
          <legend className="mb-2 text-sm font-semibold">{group.label}</legend>
          <ul className="space-y-1.5">
            {group.values.map((facet) => {
              const id = `facet-${group.key}-${facet.value}`;
              const checked = (selected[group.key] ?? []).includes(facet.value);
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
