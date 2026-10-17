"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateVariantAction, type ProductActionState } from "@/server/actions/admin/products";
import type { ProductDto, VariantDto } from "@/server/search";

function VariantRow({ productId, variant }: { productId: string; variant: VariantDto }) {
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
      attributes: {
        color: String(formData.get("color") ?? ""),
        size: String(formData.get("size") ?? ""),
        storage: String(formData.get("storage") ?? ""),
        material: String(formData.get("material") ?? ""),
      },
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
      <label className="space-y-1 text-xs text-muted-foreground">
        Farbe
        <Input
          name="color"
          defaultValue={variant.attributes.color}
          className="h-8 text-sm"
          aria-label={`Farbe ${variant.sku}`}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Grösse
        <Input
          name="size"
          defaultValue={variant.attributes.size ?? ""}
          className="h-8 text-sm"
          aria-label={`Grösse ${variant.sku}`}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Speicher (GB)
        <Input
          name="storage"
          type="number"
          min={1}
          defaultValue={variant.attributes.storage ?? ""}
          className="h-8 text-sm"
          aria-label={`Speicher ${variant.sku}`}
        />
      </label>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-4 lg:col-span-1">
        <Input
          name="material"
          placeholder="Material"
          defaultValue={variant.attributes.material ?? ""}
          className="h-8 text-sm"
          aria-label={`Material ${variant.sku}`}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Speichern
        </Button>
      </div>
    </form>
  );
}

export function VariantEditor({ product }: { product: ProductDto }) {
  return (
    <div className="rounded-xl border">
      {product.variants.map((variant) => (
        <VariantRow key={variant.sku} productId={product.id} variant={variant} />
      ))}
    </div>
  );
}
