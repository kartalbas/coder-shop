"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormatters } from "@/components/locale-formatters";
import { useLabels } from "@/components/labels";
import { contentLabel, interpolate, label, valueLabelKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { addToCart, openCartDrawer } from "@/stores/cart";
import type { ProductDto } from "@/server/search";
import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import {
  dimensionsOf,
  formatSelectionValue,
  imageIndexForColor,
  matchesSelection,
  missingDimensions,
  type Dimension,
  type Selection,
} from "@/lib/product-selection";
import { buyablePriceCents } from "@/lib/pricing";
import { useShopSettings } from "@/components/shop-settings-provider";
import { vatLabel } from "@/lib/shop-settings";
import { isLowStock } from "@/lib/stock";
import { incomingLabel } from "@/lib/purchasing/incoming";
import { Gallery } from "./gallery";
import { CompareToggle } from "./compare-toggle";
import { RestockAlertForm } from "./restock-alert-form";
import { StockIndicator } from "./stock-indicator";
import { WishlistHeart } from "./wishlist-heart";

// Issue #62 (#55): incoming stock per SKU, serialized from the open purchase orders.
export interface IncomingBySku {
  [sku: string]: { qty: number; arrival: string };
}

// Issue #61: the variant picker renders the dimensions of the product's catalog type
// configuration (labels, order, units) — never a fixed colour/size/storage triple.
export function ProductDetail({
  product,
  typeDimensions,
  incomingBySku,
}: {
  product: ProductDto;
  typeDimensions: readonly CatalogDimensionConfig[];
  incomingBySku: IncomingBySku;
}) {
  const { chf, weight } = useFormatters();
  const labels = useLabels();
  const dimensions = useMemo(
    () => dimensionsOf(product, typeDimensions),
    [product, typeDimensions],
  );
  const settings = useShopSettings();
  const [selection, setSelection] = useState<Selection>(
    () => Object.fromEntries(typeDimensions.map((dimension) => [dimension.key, null])),
  );
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
  // The photo pipeline is keyed on the "color" attribute (scripts/images) — types
  // without a colour dimension always show slot 0.
  const shownImage = imageTouched
    ? imageIndex
    : imageIndexForColor(
        product.images.length,
        product.variants,
        selection.color ?? null,
      );

  const select = (key: keyof Selection, value: string) => {
    setSelection((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
    setImageTouched(false);
    setQty(1);
  };

  // #58 step B1b: a dimension value is a table row (fallback: the value itself —
  // sizes and GB counts carry no rows and stay values); the unit suffix stays the
  // display convention.
  const valueText = (dimension: Dimension, value: string): string =>
    formatSelectionValue(
      dimension,
      contentLabel(labels, valueLabelKey(dimension.key, value), value),
    );

  const canAdd = variant !== undefined && stock > 0;

  // Issue #62 (#55): a variant with low or no stock that has open purchase orders says
  // what is on order and when it is expected — data from the POs, nothing per type.
  const incoming = variant ? incomingBySku[variant.sku] : undefined;
  const showIncoming =
    variant !== undefined &&
    incoming !== undefined &&
    isLowStock(stock, variant.restockThreshold);
  const incomingText = incoming
    ? incomingLabel(labels, incoming.qty, new Date(incoming.arrival), new Date())
    : null;

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
            {/* Issue #48/#61: comparability is a flag on the product's catalog type. */}
            {product.comparable && (
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
            <span className="text-base font-normal text-muted-foreground">
              {label(labels, "shop.price.from")}{" "}
            </span>
          )}
          {chf(price.priceCents)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {interpolate(label(labels, "shop.product.vatNote"), {
              vat: vatLabel(settings.vatRatePercent),
            })}
          </span>
        </motion.p>

        {dimensions.map((dimension) => (
          <fieldset key={dimension.key}>
            <legend className="mb-2 text-sm font-medium">
              {dimension.label}
              {selection[dimension.key] && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {valueText(dimension, selection[dimension.key] as string)}
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
                // Issue #62 (#55): a sold-out variant with incoming stock is marked —
                // sold out now, but replenishment is on order.
                const onOrder =
                  candidate !== undefined &&
                  candidate.stock === 0 &&
                  incomingBySku[candidate.sku] !== undefined;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={!candidate}
                    onClick={() => select(dimension.key, value)}
                    title={onOrder ? label(labels, "shop.product.incomingTitle") : undefined}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active && "border-primary bg-primary text-primary-foreground",
                      !active && available && "hover:border-foreground",
                      !available && "cursor-not-allowed text-muted-foreground/50 line-through",
                    )}
                  >
                    {valueText(dimension, value)}
                    {onOrder && (
                      <span
                        aria-hidden
                        className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {variant && (
          <StockIndicator stock={stock} restockThreshold={variant.restockThreshold} />
        )}

        {/* Issue #62 (#55): incoming stock for the chosen low/zero-stock variant. */}
        {showIncoming && incomingText && (
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400" role="status">
            {incomingText}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              aria-label={label(labels, "shop.product.decrease")}
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
              aria-label={label(labels, "shop.product.increase")}
              disabled={qty >= Math.min(stock, 10)}
              onClick={() => setQty((q) => Math.min(Math.min(stock, 10), q + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <Button size="lg" className="flex-1 sm:flex-none sm:px-10" disabled={!canAdd} onClick={add}>
            <ShoppingCart className="size-4" />
            {missing.length > 0
              ? interpolate(label(labels, "shop.product.selectMissing"), {
                  options: missing.join(" / "),
                })
              : canAdd
                ? label(labels, "shop.action.addToCart")
                : label(labels, "shop.state.soldOut")}
          </Button>
        </div>

        {variant && (
          <p className="text-sm text-muted-foreground">
            {interpolate(label(labels, "shop.product.variantInfo"), {
              variant: variant.label,
              weight: weight(variant.weightGrams),
              sku: variant.sku,
            })}
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
