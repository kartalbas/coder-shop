// Natural facet value order (issue #24): numbers (EU sizes, storage) numerically,
// clothing sizes by garment order (not alphabetically: L, M, S, XL, XS was the bug),
// everything else locale-sorted.

export const CLOTHING_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] as const;

export function isNumericFacetValue(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function compareFacetValues(a: string, b: string): number {
  const numericA = isNumericFacetValue(a);
  const numericB = isNumericFacetValue(b);
  if (numericA && numericB) return Number(a) - Number(b);
  if (numericA) return -1;
  if (numericB) return 1;

  const rankA = CLOTHING_SIZE_ORDER.indexOf(
    a.trim().toUpperCase() as (typeof CLOTHING_SIZE_ORDER)[number],
  );
  const rankB = CLOTHING_SIZE_ORDER.indexOf(
    b.trim().toUpperCase() as (typeof CLOTHING_SIZE_ORDER)[number],
  );
  if (rankA !== -1 && rankB !== -1) return rankA - rankB;
  if (rankA !== -1) return -1;
  if (rankB !== -1) return 1;
  return a.localeCompare(b, "de");
}
