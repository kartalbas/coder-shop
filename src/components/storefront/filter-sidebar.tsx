"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLabels } from "@/components/labels";
import { contentLabel, interpolate, label, valueLabelKey } from "@/lib/i18n";
import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { isNumericFacetValue } from "@/lib/facet-order";
import type { FacetCounts, FacetValue } from "@/server/search";

interface Group {
  key: string;
  label: string;
  unit?: string;
  // The configured dimension behind the group (#58 step B1b) — its values resolve
  // through the table; the brand column is not a dimension and stays the brand.
  dimension?: CatalogDimensionConfig;
  values: FacetValue[];
}

// Issue #61: the groups are the catalog configuration's facet dimensions for the types
// in scope — a category only ever offers the attributes its products really have
// (issue #53). Issue #24 kept: when one dimension mixes numeric and letter values
// (browsing "Alle" over EU and garment sizes), it splits into two groups; the values
// are disjoint, so both still write the same param. Issue #58 step 3: the group
// captions ("Marke", the EU/Kleider split) are translation-table texts.
function buildGroups(
  labels: Readonly<Record<string, string>>,
  facets: FacetCounts,
  dimensions: readonly CatalogDimensionConfig[],
): Group[] {
  const groups: Group[] = [{ key: "brand", label: label(labels, "shop.filter.brand"), values: facets.brand }];
  for (const dimension of dimensions) {
    const values = facets.dimensions[dimension.key] ?? [];
    if (values.length === 0) continue;
    const numeric = values.filter((v) => isNumericFacetValue(v.value));
    const letters = values.filter((v) => !isNumericFacetValue(v.value));
    if (numeric.length > 0 && letters.length > 0) {
      groups.push(
        {
          key: dimension.key,
          label: interpolate(label(labels, "shop.filter.groupEu"), { label: dimension.label }),
          unit: dimension.unit,
          dimension,
          values: numeric,
        },
        {
          key: dimension.key,
          label: interpolate(label(labels, "shop.filter.groupClothing"), { label: dimension.label }),
          unit: dimension.unit,
          dimension,
          values: letters,
        },
      );
    } else {
      groups.push({
        key: dimension.key,
        label: dimension.label,
        unit: dimension.unit,
        dimension,
        values,
      });
    }
  }
  return groups.filter((group) => group.values.length > 0);
}

interface Props {
  facets: FacetCounts;
  dimensions: readonly CatalogDimensionConfig[];
  selected: Record<string, string[]>;
  onToggle: (key: string, value: string) => void;
}

export function FilterSidebar({ facets, dimensions, selected, onToggle }: Props) {
  const labels = useLabels();
  const groups = buildGroups(labels, facets, dimensions);
  if (groups.length === 0) return null;

  return (
    <aside aria-label={label(labels, "shop.listing.filter")} className="space-y-6">
      {groups.map((group) => (
        <fieldset key={`${group.key}-${group.label}`}>
          <legend className="mb-2 text-sm font-semibold">{group.label}</legend>
          <ul className="space-y-1.5">
            {group.values.map((facet) => {
              const id = `facet-${group.key}-${group.label}-${facet.value}`;
              const checked = (selected[group.key] ?? []).includes(facet.value);
              return (
                <li key={facet.value} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => onToggle(group.key, facet.value)}
                  />
                  <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                    {(() => {
                      // #58 step B1b: dimension values are table rows (fallback: the
                      // value itself); the unit suffix stays the display convention.
                      const text = group.dimension
                        ? contentLabel(labels, valueLabelKey(group.key, facet.value), facet.value)
                        : facet.value;
                      return group.unit ? `${text} ${group.unit}` : text;
                    })()}
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
