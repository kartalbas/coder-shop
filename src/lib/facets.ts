export interface ProductAttributes {
  color: string;
  size?: string;
  storage?: number;
  material?: string;
}

export interface VariantForFacets {
  attributes: ProductAttributes;
}

export interface DerivedFilter {
  colors: string[];
  sizes: string[];
  storage: number[];
  materials: string[];
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
}

function sortSizes(sizes: string[]): string[] {
  const unique = [...new Set(sizes)];
  if (unique.every((size) => /^\d+$/.test(size))) {
    return unique.sort((a, b) => Number(a) - Number(b));
  }
  return unique.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    return (ia === -1 ? SIZE_ORDER.length : ia) - (ib === -1 ? SIZE_ORDER.length : ib);
  });
}

export function deriveFilter(variants: VariantForFacets[]): DerivedFilter {
  return {
    colors: uniqueSorted(variants.map((v) => v.attributes.color)),
    sizes: sortSizes(variants.map((v) => v.attributes.size).filter((s): s is string => s != null)),
    storage: [...new Set(variants.map((v) => v.attributes.storage).filter((s): s is number => s != null))].sort(
      (a, b) => a - b,
    ),
    materials: uniqueSorted(
      variants.map((v) => v.attributes.material).filter((m): m is string => m != null),
    ),
  };
}
