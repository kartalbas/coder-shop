"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatChf, formatWeight } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addToCart, openCartDrawer } from "@/stores/cart";
import type { ProductDto, VariantDto } from "@/server/search";
import { Gallery } from "./gallery";
import { StockIndicator } from "./stock-indicator";
import { VAT_LABEL } from "@/lib/pricing";

type Dimension = { key: "color" | "size" | "storage"; label: string; values: string[] };

function dimensionsOf(product: ProductDto): Dimension[] {
  const dims: Dimension[] = [];
  const colors = [...new Set(product.variants.map((v) => v.attributes.color))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
  if (colors.length > 0) dims.push({ key: "color", label: "Farbe", values: colors });
  const sizes = [...new Set(product.variants.map((v) => v.attributes.size).filter(Boolean))] as string[];
  if (sizes.length > 0) dims.push({ key: "size", label: "Grösse", values: sizes });
  const storage = [...new Set(product.variants.map((v) => v.attributes.storage).filter(Boolean))] as number[];
  if (storage.length > 0) {
    dims.push({ key: "storage", label: "Speicher", values: storage.sort((a, b) => a - b).map(String) });
  }
  return dims;
}

function matches(variant: VariantDto, selection: Record<string, string | null>): boolean {
  return (["color", "size", "storage"] as const).every((key) => {
    const wanted = selection[key];
    if (wanted == null) return true;
    return String(variant.attributes[key] ?? "") === wanted;
  });
}

export function ProductDetail({ product }: { product: ProductDto }) {
  const dimensions = useMemo(() => dimensionsOf(product), [product]);
  const [selection, setSelection] = useState<Record<string, string | null>>({
    color: null,
    size: null,
    storage: null,
  });
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageTouched, setImageTouched] = useState(false);

  const variant =
    product.variants.find((v) => matches(v, selection)) ?? product.variants[0];
  const variantIndex = variant ? product.variants.indexOf(variant) : 0;
  const priceCents = product.priceCents + (variant?.priceDeltaCents ?? 0);
  const stock = variant?.stock ?? 0;
  const shownImage = imageTouched
    ? imageIndex
    : Math.min(variantIndex, Math.max(0, product.images.length - 1));

  const select = (key: string, value: string) => {
    setSelection((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
    setImageTouched(false);
    setQty(1);
  };

  const canAdd = stock > 0;

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
        unitPriceCents: priceCents,
        stock: variant.stock,
      },
      qty,
    );
    toast.success("Zum Warenkorb hinzugefügt", { description: `${product.name} — ${variant.label}` });
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
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
        </div>

        <motion.p
          key={variant?.sku ?? "base"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="text-2xl font-semibold"
        >
          {formatChf(priceCents)}
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
                  matches(v, { ...selection, [dimension.key]: value }),
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
            {canAdd ? "In den Warenkorb" : "Ausverkauft"}
          </Button>
        </div>

        {variant && (
          <p className="text-sm text-muted-foreground">
            Variante: {variant.label} · Gewicht: {formatWeight(variant.weightGrams)} · Art.-Nr.{" "}
            {variant.sku}
          </p>
        )}
      </div>
    </div>
  );
}
