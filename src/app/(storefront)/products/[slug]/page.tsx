export const instant = false;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { JsonLd } from "@/components/storefront/json-ld";
import { ProductDetail } from "@/components/storefront/product-detail";
import { RelatedProducts } from "@/components/storefront/related-products";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";
import { getProductBySlug, getRelatedProducts } from "@/server/search";
import { VAT_LABEL } from "@/lib/pricing";

interface PagePropsLocal {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  // Issue #37: the product lookup below runs in the prerender stage unless this request
  // is unwrapped first — the MongoDB driver's internal `new Date()` (CMAP events) then
  // trips Next's "unstable value while prerendering" guard on every product page view.
  await connection();
  const { slug } = await params;
  // Issue #28: the real product name, not the de-slugged URL ("oneplus oneplus 13t 067").
  const product = await getProductBySlug(slug);
  const name = product?.name ?? slug.replace(/-/g, " ");
  return {
    title: name,
    description: `${name} — coder-shop. Preise in CHF inklusive ${VAT_LABEL}.`,
  };
}

async function ProductView({ params }: PagePropsLocal) {
  await connection();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  // Issue #28: this runs before any Suspense fallback can start the stream, so
  // unknown slugs answer with a real HTTP 404 (see docs: loading.md "Status codes").
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Start", href: "/" },
          { label: PRODUCT_TYPE_LABELS[product.type], href: `/produkte?type=${product.type}` },
          { label: product.name },
        ]}
      />
      <div className="mt-6">
        <ProductDetail product={product} />
      </div>

      <Accordion type="single" collapsible className="mt-10 border-t">
        <AccordionItem value="description">
          <AccordionTrigger>Beschreibung</AccordionTrigger>
          <AccordionContent>
            <p className="whitespace-pre-line text-sm leading-relaxed">{product.description}</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="details">
          <AccordionTrigger>Details & Varianten</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1 text-sm">
              {product.variants.map((variant) => (
                <li key={variant.sku} className="flex justify-between gap-4">
                  <span>{variant.label}</span>
                  <span className="text-muted-foreground">{variant.sku}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-12" />
      <RelatedProducts products={related} />
      <JsonLd product={product} />
    </div>
  );
}

// No Suspense wrapper here on purpose (issue #28): a fallback would flush the
// response early and pin the status at 200 for unknown slugs.
export default function ProductPage({ params }: PagePropsLocal) {
  return <ProductView params={params} />;
}
