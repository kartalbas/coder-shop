"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatChf, formatWeight } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addToCart, openCartDrawer } from "@/stores/cart";
import type { ProductDto } from "@/server/search";
import {
  dimensionsOf,
  imageIndexForColor,
  matchesSelection,
  missingDimensions,
  type Selection,
} from "@/lib/product-selection";
import { buyablePriceCents } from "@/lib/pricing";
import { Gallery } from "./gallery";
import { CompareToggle } from "./compare-toggle";
import { RestockAlertForm } from "./restock-alert-form";
import { StockIndicator } from "./stock-indicator";
import { WishlistHeart } from "./wishlist-heart";
import { VAT_LABEL } from "@/lib/pricing";

export function ProductDetail({ product }: { product: ProductDto }) {
  const dimensions = useMemo(() => dimensionsOf(product), [product]);
  const [selection, setSelection] = useState<Selection>({
    color: null,
    size: null,
    storage: null,
  });
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageTouched, setImageTouched] = useState(false);

  // A concrete variant exists only once every dimension is chosen (issue #18) — no
  // silent fallback to the first variant.
  const missing = missingDimensions(dimensions, selection);
  const variant =
    missing.length === 0
      ? product.variants.find((v) => matchesSelection(v, selection))
      : undefined;
  const price = variant
    ? { priceCents: product.priceCents + variant.priceDeltaCents, from: false }
    : buyablePriceCents(product.priceCents, product.variants.map((v) => v.priceDeltaCents));
  const stock = variant?.stock ?? 0;
  // The gallery follows the chosen colour (the slot a photo was generated for carries
  // that colour), not the variant index (issue #19).
  const shownImage = imageTouched
    ? imageIndex
    : imageIndexForColor(product.images.length, product.variants, selection.color);

  const select = (key: keyof Selection, value: string) => {
    setSelection((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
    setImageTouched(false);
    setQty(1);
  };

  const canAdd = variant !== undefined && stock > 0;

  const add = () => {
    if (!variant || !canAdd) return;
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        sku: variant.sku,
        name: product.name,
        variantLabel: variant.label,
        imageSrc: product.images[0]?.src ?? "",
        unitPriceCents: price.priceCents,
        stock: variant.stock,
      },
      qty,
    );
    // Issue #59: no toast here — the drawer opening (with the animated badge) is the
    // feedback; the toast only collided with the drawer's „Zur Kasse“.
    openCartDrawer();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Gallery
        product={product}
        imageIndex={shownImage}
        onImageChange={(index) => {
          setImageIndex(index);
          setImageTouched(true);
        }}
      />
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{product.brand}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          </div>
          {/* Issue #46: the wishlist heart on the product page. */}
          <div className="mt-1 flex shrink-0 gap-2">
            <WishlistHeart slug={product.slug} name={product.name} />
            {/* Issue #48: smartphones join the side-by-side comparison. */}
            {product.type === "smartphone" && (
              <CompareToggle slug={product.slug} name={product.name} />
            )}
          </div>
        </div>

        <motion.p
          key={variant?.sku ?? "base"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="text-2xl font-semibold"
        >
          {price.from && (
            <span className="text-base font-normal text-muted-foreground">ab </span>
          )}
          {formatChf(price.priceCents)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">inkl. {VAT_LABEL}.</span>
        </motion.p>

        {dimensions.map((dimension) => (
          <fieldset key={dimension.key}>
            <legend className="mb-2 text-sm font-medium">
              {dimension.label}
              {selection[dimension.key] && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {dimension.key === "storage" ? `${selection[dimension.key]} GB` : selection[dimension.key]}
                </span>
              )}
            </legend>
            <div className="flex flex-wrap gap-2">
              {dimension.values.map((value) => {
                const candidate = product.variants.find((v) =>
                  matchesSelection(v, { ...selection, [dimension.key]: value }),
                );
                const available = candidate !== undefined && candidate.stock > 0;
                const active = selection[dimension.key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={!candidate}
                    onClick={() => select(dimension.key, value)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active && "border-primary bg-primary text-primary-foreground",
                      !active && available && "hover:border-foreground",
                      !available && "cursor-not-allowed text-muted-foreground/50 line-through",
                    )}
                  >
                    {dimension.key === "storage" ? `${value} GB` : value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {variant && (
          <StockIndicator stock={stock} restockThreshold={variant.restockThreshold} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="Menge verringern"
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-10 text-center font-medium tabular-nums" aria-live="polite">
              {qty}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label="Menge erhöhen"
              disabled={qty >= Math.min(stock, 10)}
              onClick={() => setQty((q) => Math.min(Math.min(stock, 10), q + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <Button size="lg" className="flex-1 sm:flex-none sm:px-10" disabled={!canAdd} onClick={add}>
            <ShoppingCart className="size-4" />
            {missing.length > 0
              ? `Bitte ${missing.join(" / ")} wählen`
              : canAdd
                ? "In den Warenkorb"
                : "Ausverkauft"}
          </Button>
        </div>

        {variant && (
          <p className="text-sm text-muted-foreground">
            Variante: {variant.label} · Gewicht: {formatWeight(variant.weightGrams)} · Art.-Nr.{" "}
            {variant.sku}
          </p>
        )}

        {/* Issue #46: a chosen variant that is sold out offers the back-in-stock mail. */}
        {variant && stock === 0 && (
          <RestockAlertForm sku={variant.sku} productName={`${product.name} — ${variant.label}`} />
        )}
      </div>
    </div>
  );
}
