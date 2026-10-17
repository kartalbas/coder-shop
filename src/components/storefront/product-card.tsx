import Link from "next/link";
import { formatChf } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { ProductDto } from "@/server/search";

export function ProductCard({ product }: { product: ProductDto }) {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  return (
    <Link
      href={`/produkt/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.images[0] ? (
          <img
            src={product.images[0].src}
            alt={product.images[0].alt}
            loading="lazy"
            className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        {product.featured && (
          <Badge className="absolute left-2 top-2" variant="secondary">
            Beliebt
          </Badge>
        )}
        {totalStock === 0 && (
          <Badge className="absolute right-2 top-2" variant="destructive">
            Ausverkauft
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.brand}</p>
        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
        <p className="mt-auto pt-1 text-sm font-semibold">{formatChf(product.priceCents)}</p>
      </div>
    </Link>
  );
}
