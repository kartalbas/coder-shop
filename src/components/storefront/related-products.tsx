import { ProductCard } from "./product-card";
import { label } from "@/lib/i18n";
import type { ProductDto } from "@/server/search";

// Issue #58 step 3: the heading comes from the translation table, resolved to the
// request language by the page.
export function RelatedProducts({
  products,
  labels,
}: {
  products: ProductDto[];
  labels: Record<string, string>;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16" aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-6 text-2xl font-semibold tracking-tight">
        {label(labels, "shop.product.related")}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
