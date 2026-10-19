export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { FeaturedToggle, ProductCoreForm } from "@/components/admin/product-core-form";
import { ProductContentTranslations } from "@/components/admin/product-content-translations";
import { ImageEditor } from "@/components/admin/image-editor";
import { VariantEditor } from "@/components/admin/variant-editor";
import { BASE_LANGUAGE, interpolate, label, productContentKeys } from "@/lib/i18n";
import { getCatalogType } from "@/server/catalog-types";
import { getActiveLanguages, getRequestLabels, getTranslations } from "@/server/i18n";
import { getIncomingBySkuCore } from "@/server/purchasing";
import { getProductForAdmin } from "@/server/products-admin";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  await connection();
  const [{ id }, labels] = await Promise.all([params, getRequestLabels()]);
  return {
    title: interpolate(label(labels, "admin.meta.productDetail.title"), { id }),
    description: label(labels, "admin.meta.productDetail.description"),
  };
}

async function ProductAdminDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const [product, labels] = await Promise.all([getProductForAdmin(id), getRequestLabels()]);
  if (!product) notFound();
  // Issue #61: type label and the variant editor's attribute fields come from the
  // product type's configuration.
  // Issue #62 (#55): incoming quantities per variant come from the open purchase orders.
  // Issue #58 step B2: the translation section edits the product's content rows —
  // the two rows of this slug and the active languages minus the base drive it, so a
  // sixth language appears there without a code change.
  const [typeConfig, incoming, allRows, languages] = await Promise.all([
    getCatalogType(product.type),
    getIncomingBySkuCore(product.variants.map((variant) => variant.sku)),
    getTranslations(),
    getActiveLanguages(),
  ]);
  const keys = productContentKeys(product.slug);
  const contentRows = allRows.filter((row) => row.key === keys.name || row.key === keys.description);
  const contentLanguages = languages.filter((language) => language.code !== BASE_LANGUAGE);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {label(labels, "admin.products.back")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.brand} · {typeConfig?.label ?? product.type} ·{" "}
            <span className="font-mono">{product.slug}</span>
          </p>
        </div>
        <FeaturedToggle productId={product.id} featured={product.featured} />
      </div>

      <section
        className="mt-6 rounded-xl border bg-card p-5"
        aria-label={label(labels, "admin.products.coreHeading")}
      >
        <h2 className="mb-3 text-sm font-semibold">{label(labels, "admin.products.coreHeading")}</h2>
        <ProductCoreForm product={product} />
      </section>

      <section className="mt-6" aria-label={label(labels, "admin.products.column.variants")}>
        <h2 className="mb-3 text-sm font-semibold">
          {interpolate(label(labels, "admin.products.variantsHeading"), {
            count: product.variants.length,
          })}
        </h2>
        <VariantEditor
          product={product}
          dimensions={typeConfig?.dimensions ?? []}
          incomingBySku={Object.fromEntries([...incoming].map(([sku, info]) => [sku, info.qty]))}
          serialTracked={typeConfig?.stockTracking === "serial"}
        />
      </section>

      <section className="mt-6" aria-label={label(labels, "admin.contentTranslations.heading")}>
        <h2 className="mb-3 text-sm font-semibold">
          {label(labels, "admin.contentTranslations.heading")}
        </h2>
        <ProductContentTranslations
          product={product}
          rows={contentRows}
          languages={contentLanguages}
        />
      </section>

      <section className="mt-6" aria-label={label(labels, "admin.products.imagesAria")}>
        <h2 className="mb-3 text-sm font-semibold">
          {interpolate(label(labels, "admin.products.imagesHeading"), {
            count: product.images.length,
          })}
        </h2>
        <ImageEditor product={product} />
      </section>
    </div>
  );
}

export default function AdminProductDetailPage({ params }: PagePropsLocal) {
  return <ProductAdminDetail params={params} />;
}
