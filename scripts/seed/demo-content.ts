import { generateCatalog, type SeedProduct } from "./catalog";

// The bounded five-language demo content set (#58 step B1a): the first three products
// per catalog type by slug, derived from the seed's own generator — no hard-coded
// slugs, no product special-casing. The seed file's rows, the integration tests and
// the e2e specs all read this one derivation, so a generator change moves all of them
// together.
export function firstThreePerTypeBySlug(): SeedProduct[] {
  const byType = new Map<string, SeedProduct[]>();
  for (const product of generateCatalog()) {
    const list = byType.get(product.type) ?? [];
    list.push(product);
    byType.set(product.type, list);
  }
  return [...byType.values()].flatMap((products) =>
    [...products].sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 3),
  );
}
