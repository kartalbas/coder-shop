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
import { RecentlyViewedRail, RecentlyViewedTracker } from "@/components/storefront/recently-viewed";
import { RelatedProducts } from "@/components/storefront/related-products";
import { ReviewSection } from "@/components/storefront/review-section";
import { getIntlLocale, getLabels } from "@/server/i18n";
import { contentLabel, interpolate, label, typeLabelKey } from "@/lib/i18n";
import { localizeCatalogTypes } from "@/lib/catalog-types";
import { getCatalogType } from "@/server/catalog-types";
import { getIncomingBySkuCore } from "@/server/purchasing";
import { getProductBySlug, getRelatedProducts } from "@/server/search";
import { getProductReviewsCore } from "@/server/reviews";
import { vatLabel } from "@/lib/shop-settings";
import { getShopSettings } from "@/server/shop-settings";

interface PagePropsLocal {
  params: Promise<{ slug: string; lang: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  // Issue #37: the product lookup below runs in the prerender stage unless this request
  // is unwrapped first — the MongoDB driver's internal `new Date()` (CMAP events) then
  // trips Next's "unstable value while prerendering" guard on every product page view.
  await connection();
  const { slug, lang } = await params;
  // Issue #28: the real product name, not the de-slugged URL ("oneplus oneplus 13t 067").
  // Issue #58 step B1a: the labels come first — the product DTO resolves its name and
  // description through the table, so the meta title's {name} localizes for free.
  const [settings, labels] = await Promise.all([getShopSettings(), getLabels(lang)]);
  const product = await getProductBySlug(slug, labels);
  const name = product?.name ?? slug.replace(/-/g, " ");
  // #58 step 3: the description is a table row — {name} and the configured VAT label
  // fill it, so every language ships its own sentence.
  return {
    title: name,
    description: interpolate(label(labels, "shop.meta.product.description"), {
      name,
      vat: vatLabel(settings.vatRatePercent),
    }),
  };
}

async function ProductView({ params }: PagePropsLocal) {
  await connection();
  const { slug, lang } = await params;
  // Issue #58 step B1a: the request language's label map resolves the product's
  // content keys — h1, breadcrumb entry and description answer in the request
  // language, the stored German only as the fallback.
  const labels = await getLabels(lang);
  const product = await getProductBySlug(slug, labels);
  // Issue #28: this runs before any Suspense fallback can start the stream, so
  // unknown slugs answer with a real HTTP 404 (see docs: loading.md "Status codes").
  if (!product) notFound();
  // Issue #61: the category label and the variant dimensions come from the product
  // type's configuration.
  // Issue #62 (#55): what is on order for this product's variants — derived from the
  // open purchase orders, shown on low/zero-stock variants.
  const [related, { aggregate }, typeConfig, incoming] = await Promise.all([
    getRelatedProducts(product, 4, labels),
    getProductReviewsCore(product.id),
    getCatalogType(product.type),
    getIncomingBySkuCore(product.variants.map((variant) => variant.sku)),
  ]);
  // Issue #58 step B1b: the category label and the picker's dimension captions are
  // table rows too — resolved through the same label map (fallback: the configured
  // German label); attribute values localize in the client picker and the DTO.
  const categoryLabel = contentLabel(
    labels,
    typeLabelKey(product.type),
    typeConfig?.label ?? product.type,
  );
  const typeDimensions = typeConfig
    ? localizeCatalogTypes([typeConfig], labels)[0].dimensions
    : [];
  const incomingBySku = Object.fromEntries(
    [...incoming].map(([sku, info]) => [sku, { qty: info.qty, arrival: info.arrival.toISOString() }]),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs
        ariaLabel={label(labels, "shop.breadcrumbs.aria")}
        items={[
          { label: label(labels, "shop.breadcrumbs.start"), href: "/" },
          { label: categoryLabel, href: `/products?type=${encodeURIComponent(product.type)}` },
          { label: product.name },
        ]}
      />
      <div className="mt-6">
        <ProductDetail
          product={product}
          typeDimensions={typeDimensions}
          incomingBySku={incomingBySku}
        />
      </div>

      <Accordion type="single" collapsible className="mt-10 border-t">
        <AccordionItem value="description">
          <AccordionTrigger>{label(labels, "shop.product.description")}</AccordionTrigger>
          <AccordionContent>
            <p className="whitespace-pre-line text-sm leading-relaxed">{product.description}</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="details">
          <AccordionTrigger>{label(labels, "shop.product.details")}</AccordionTrigger>
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
      <RelatedProducts products={related} labels={labels} />
      {/* Issue #47: reviews from verified buyers, with average and distribution. */}
      <ReviewSection
        product={product}
        intlLocale={await getIntlLocale(lang)}
        labels={labels}
      />
      {/* Issue #46: remember this product, and show the rest of the history. */}
      <RecentlyViewedTracker slug={product.slug} />
      <RecentlyViewedRail excludeSlug={product.slug} />
      <JsonLd
        product={product}
        categoryLabel={categoryLabel}
        aggregateRating={aggregate}
        homeLabel={label(labels, "shop.breadcrumbs.start")}
      />
    </div>
  );
}

// No Suspense wrapper here on purpose (issue #28): a fallback would flush the
// response early and pin the status at 200 for unknown slugs.
export default function ProductPage({ params }: PagePropsLocal) {
  return <ProductView params={params} />;
}
