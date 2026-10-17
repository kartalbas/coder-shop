// The product type union lives in the pure lib (issue #35): `src/lib` must not import
// from `src/models` (mongoose). The model re-exports it for its own consumers.
export type ProductType = "smartphone" | "shoes" | "clothing";
