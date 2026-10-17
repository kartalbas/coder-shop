import type { ProductDto } from "@/server/search";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";
import { absoluteUrl } from "@/lib/site";

// Issue #28: structured data must be complete for crawlers — absolute image URLs,
// an url per offer and a BreadcrumbList matching the visible breadcrumbs.
// Issue #47: approved reviews surface as an AggregateRating on the Product.
export function JsonLd({
  product,
  aggregateRating,
}: {
  product: ProductDto;
  aggregateRating?: { average: number; count: number };
}) {
  const productUrl = absoluteUrl(`/produkt/${product.slug}`);
  const categoryUrl = absoluteUrl(`/produkte?type=${product.type}`);
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description,
        brand: { "@type": "Brand", name: product.brand },
        image: product.images.map((image) => absoluteUrl(image.src)),
        url: productUrl,
        ...(aggregateRating && aggregateRating.count > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: aggregateRating.average,
                reviewCount: aggregateRating.count,
              },
            }
          : {}),
        offers: product.variants.map((variant) => ({
          "@type": "Offer",
          url: productUrl,
          sku: variant.sku,
          price: ((product.priceCents + variant.priceDeltaCents) / 100).toFixed(2),
          priceCurrency: "CHF",
          availability:
            variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Start", item: absoluteUrl("/") },
          {
            "@type": "ListItem",
            position: 2,
            name: PRODUCT_TYPE_LABELS[product.type],
            item: categoryUrl,
          },
          { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
        ],
      },
    ],
  };
  const html = JSON.stringify(json).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: html }} />;
}
