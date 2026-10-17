"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { updateVariantAction, type ProductActionState } from "@/server/actions/admin/products";
import type { ProductDto, VariantDto } from "@/server/search";

// Issue #61: the attribute fields are the product type's configured dimensions —
// one input per dimension, no fixed colour/size/storage/material set.
function VariantRow({
  productId,
  variant,
  dimensions,
}: {
  productId: string;
  variant: VariantDto;
  dimensions: readonly CatalogDimensionConfig[];
}) {
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    updateVariantAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(`Variante ${variant.sku} gespeichert.`);
  }, [state, variant.sku]);

  const handleSubmit = (formData: FormData) => {
    const payload = {
      priceDeltaCents: Math.round(Number(formData.get("priceDelta") ?? 0) * 100),
      stock: Number(formData.get("stock") ?? 0),
      expectedStock: variant.stock,
      weightGrams: Number(formData.get("weight") ?? 0),
      attributes: Object.fromEntries(
        dimensions.map((dimension) => [
          dimension.key,
          String(formData.get(`attr-${dimension.key}`) ?? ""),
        ]),
      ),
    };
    formData.set("payload", JSON.stringify(payload));
    return formAction(formData);
  };

  return (
    <form
      action={handleSubmit}
      className="grid grid-cols-2 items-end gap-2 border-b p-3 last:border-0 sm:grid-cols-4 lg:grid-cols-8"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="sku" value={variant.sku} />
      <div className="col-span-2 text-sm lg:col-span-1">
        <p className="font-medium">{variant.sku}</p>
        <p className="text-xs text-muted-foreground">{variant.label}</p>
      </div>
      <label className="space-y-1 text-xs text-muted-foreground">
        Preisdifferenz (CHF)
        <Input
          name="priceDelta"
          type="number"
          step="0.05"
          defaultValue={(variant.priceDeltaCents / 100).toFixed(2)}
          className="h-8 text-sm"
          aria-label={`Preisdifferenz ${variant.sku}`}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Lager
        <Input
          name="stock"
          type="number"
          min={0}
          defaultValue={variant.stock}
          className="h-8 text-sm"
          aria-label={`Lager ${variant.sku}`}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Gewicht (g)
        <Input
          name="weight"
          type="number"
          min={1}
          defaultValue={variant.weightGrams}
          className="h-8 text-sm"
          aria-label={`Gewicht ${variant.sku}`}
        />
      </label>
      {dimensions.map((dimension) => (
        <label key={dimension.key} className="space-y-1 text-xs text-muted-foreground">
          {dimension.label}
          {dimension.unit ? ` (${dimension.unit})` : ""}
          <Input
            name={`attr-${dimension.key}`}
            defaultValue={
              variant.attributes[dimension.key] === undefined ||
              variant.attributes[dimension.key] === null
                ? ""
                : String(variant.attributes[dimension.key])
            }
            className="h-8 text-sm"
            aria-label={`${dimension.label} ${variant.sku}`}
          />
        </label>
      ))}
      <div className="col-span-2 flex items-end sm:col-span-4 lg:col-span-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Speichern
        </Button>
      </div>
    </form>
  );
}

export function VariantEditor({
  product,
  dimensions,
}: {
  product: ProductDto;
  dimensions: readonly CatalogDimensionConfig[];
}) {
  return (
    <div className="rounded-xl border">
      {product.variants.map((variant) => (
        <VariantRow key={variant.sku} productId={product.id} variant={variant} dimensions={dimensions} />
      ))}
    </div>
  );
}
