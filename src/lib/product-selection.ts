import type { ProductDto, VariantDto } from "@/server/search";

type SelectionKey = "color" | "size" | "storage";
export type Selection = Record<SelectionKey, string | null>;

export interface Dimension {
  key: SelectionKey;
  label: string;
  values: string[];
}

export function dimensionsOf(product: ProductDto): Dimension[] {
  const dims: Dimension[] = [];
  const colors = [...new Set(product.variants.map((v) => v.attributes.color))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
  if (colors.length > 0) dims.push({ key: "color", label: "Farbe", values: colors });
  const sizes = [
    ...new Set(product.variants.map((v) => v.attributes.size).filter(Boolean)),
  ] as string[];
  if (sizes.length > 0) dims.push({ key: "size", label: "Grösse", values: sizes });
  const storage = [
    ...new Set(product.variants.map((v) => v.attributes.storage).filter(Boolean)),
  ] as number[];
  if (storage.length > 0) {
    dims.push({
      key: "storage",
      label: "Speicher",
      values: storage.sort((a, b) => a - b).map(String),
    });
  }
  return dims;
}

export function matchesSelection(variant: VariantDto, selection: Selection): boolean {
  return (["color", "size", "storage"] as const).every((key) => {
    const wanted = selection[key];
    if (wanted == null) return true;
    return String(variant.attributes[key] ?? "") === wanted;
  });
}

// Every dimension the product has must be chosen before the item can go to the cart
// (issue #18) — the labels of what is still missing.
export function missingDimensions(
  dimensions: Dimension[],
  selection: Selection,
): string[] {
  return dimensions.filter((d) => selection[d.key] == null).map((d) => d.label);
}

// Photo slot i shows the colour of variant i % variantCount (the rule the image
// generator used, scripts/images/generate.ts) — so a chosen colour maps back to the
// slots that depict it (issue #19).
export function slotColor(variants: VariantDto[], slot: number): string | undefined {
  if (variants.length === 0) return undefined;
  return variants[slot % variants.length]?.attributes.color;
}

export function imageIndexForColor(
  imageCount: number,
  variants: VariantDto[],
  color: string | null,
): number {
  if (!color || imageCount === 0) return 0;
  for (let i = 0; i < imageCount; i++) {
    if (slotColor(variants, i) === color) return i;
  }
  return 0;
}
