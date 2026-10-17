// The shop's featured collections (issue #23) — one source for the seed, the home page
// sections, the listing `?collection=` filter and the mega-menu links.
export const COLLECTIONS = ["Neuheiten", "Bestseller", "Sale"] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
