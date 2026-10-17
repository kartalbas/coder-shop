import type { ProductDto } from "@/server/search";

export function JsonLd({ product }: { product: ProductDto }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((image) => image.src),
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      sku: variant.sku,
      price: ((product.priceCents + variant.priceDeltaCents) / 100).toFixed(2),
      priceCurrency: "CHF",
      availability:
        variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}
