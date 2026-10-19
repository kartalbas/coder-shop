// The one slug spelling (#58 step B1b): lowercase, umlauts decomposed and stripped,
// non-alphanumerics collapsed to "-". The seed's SKU/slug builder and the translation
// key segments for attribute values (valueLabelKey) both read this — a value maps to
// the same segment everywhere, and the segments pass the translation key guard
// ([a-zA-Z0-9-] only).
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
