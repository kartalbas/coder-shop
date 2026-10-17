export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { FeaturedToggle, ProductCoreForm } from "@/components/admin/product-core-form";
import { VariantEditor } from "@/components/admin/variant-editor";
import { ProductImage } from "@/components/storefront/product-image";
import { PRODUCT_TYPE_LABELS } from "@/lib/menu";
import { getProductForAdmin } from "@/server/products-admin";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { id } = await params;
  return { title: `Produkt ${id} — Admin`, description: "Stammdaten, Varianten und Bilder." };
}

async function ProductAdminDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const product = await getProductForAdmin(id);
  if (!product) notFound();

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zur Produktliste
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.brand} · {PRODUCT_TYPE_LABELS[product.type]} ·{" "}
            <span className="font-mono">{product.slug}</span>
          </p>
        </div>
        <FeaturedToggle productId={product.id} featured={product.featured} />
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5" aria-label="Stammdaten">
        <h2 className="mb-3 text-sm font-semibold">Stammdaten</h2>
        <ProductCoreForm product={product} />
      </section>

      <section className="mt-6" aria-label="Varianten">
        <h2 className="mb-3 text-sm font-semibold">
          Varianten ({product.variants.length}) — Preisdifferenz, Lager, Gewicht, Attribute
        </h2>
        <VariantEditor product={product} />
      </section>

      <section className="mt-6" aria-label="Bilder">
        <h2 className="mb-3 text-sm font-semibold">Bilder ({product.images.length})</h2>
        <ul className="flex flex-wrap gap-3">
          {product.images.map((image) => (
            <li key={image.src} className="w-28">
              <ProductImage
                src={image.src}
                alt={image.alt}
                className="aspect-square w-full rounded-lg border object-cover"
              />
              <p className="mt-1 truncate text-xs text-muted-foreground" title={image.src}>
                {image.src.split("/").pop()}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Fotos erzeugt das Bild-Tool (<code>npm run images</code>) und schreibt die Pfade auf das
          Produkt; hier werden sie kontrolliert.
        </p>
      </section>
    </div>
  );
}

export default function AdminProductDetailPage({ params }: PagePropsLocal) {
  return <ProductAdminDetail params={params} />;
}
