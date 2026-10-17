export const instant = false;

import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { JsonLd } from "@/components/storefront/json-ld";
import { ProductDetail } from "@/components/storefront/product-detail";
import { RelatedProducts } from "@/components/storefront/related-products";
import { getProductBySlug, getRelatedProducts } from "@/server/search";

const TYPE_LABELS: Record<string, string> = {
  smartphone: "Smartphones",
  shoes: "Schuhe",
  clothing: "Kleidung",
};

interface PagePropsLocal {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ");
  return {
    title: name,
    description: `${name} — coder-shop. Preise in CHF inklusive 8,1 % MwSt.`,
  };
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

async function ProductView({ params }: PagePropsLocal) {
  await connection();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Start", href: "/" },
          { label: TYPE_LABELS[product.type], href: `/produkte?type=${product.type}` },
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

export default function ProductPage({ params }: PagePropsLocal) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductView params={params} />
    </Suspense>
  );
}
