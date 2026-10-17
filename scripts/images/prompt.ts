import type { ProductType } from "@/models/product";

export const IMAGE_VIEWS = ["front", "side", "back", "detail", "lifestyle"] as const;
export type ImageView = (typeof IMAGE_VIEWS)[number];

const VIEW_NOUNS: Record<ProductType, string> = {
  smartphone: "smartphone",
  shoes: "athletic sneaker",
  clothing: "outdoor garment",
};

const GERMAN_VIEW_NAMES: Record<ImageView, string> = {
  front: "Frontansicht",
  side: "Seitenansicht",
  back: "Rückansicht",
  detail: "Detailansicht",
  lifestyle: "Lifestyle-Ansicht",
};

const COLOR_TRANSLATIONS: Record<string, string> = {
  schwarz: "black",
  weiss: "white",
  blau: "blue",
  grün: "green",
  titan: "titanium",
  grau: "grey",
  anthrazit: "charcoal grey",
  oliv: "olive",
  rot: "red",
  beige: "beige",
};

const MATERIAL_TRANSLATIONS: Record<string, string> = {
  baumwolle: "cotton",
  polyester: "polyester",
  wolle: "wool",
  daune: "down",
  fleece: "fleece",
  softshell: "softshell",
};

export function viewForImage(index: number): ImageView {
  return IMAGE_VIEWS[index % IMAGE_VIEWS.length];
}

export function imageSeed(slug: string, imageNumber: number): number {
  const value = `${slug}-${imageNumber}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface PromptInput {
  type: ProductType;
  color: string;
  material?: string;
  view: ImageView;
}

export function buildImagePrompt({ type, color, material, view }: PromptInput): string {
  const colorEn = COLOR_TRANSLATIONS[color.toLowerCase()] ?? color;
  const materialEn = material ? MATERIAL_TRANSLATIONS[material.toLowerCase()] ?? material : null;
  const subject = `${VIEW_NOUNS[type]} in ${colorEn}${materialEn ? `, ${materialEn}` : ""}`;
  return (
    `Professional studio product photography of a ${subject}, ${view} view, ` +
    `soft studio lighting, clean neutral background, photorealistic, high detail, ` +
    `centered composition, no logos, no text, no watermark, no people`
  );
}

export function imageAlt(name: string, view: ImageView): string {
  return `${name} – ${GERMAN_VIEW_NAMES[view]}`;
}
