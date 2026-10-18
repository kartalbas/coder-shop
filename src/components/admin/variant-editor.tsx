"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogDimensionConfig } from "@/lib/catalog-types";
import { interpolate, label } from "@/lib/i18n";
import { updateVariantAction, type ProductActionState } from "@/server/actions/admin/products";
import type { ProductDto, VariantDto } from "@/server/search";

// Issue #61: the attribute fields are the product type's configured dimensions —
// one input per dimension, no fixed colour/size/storage/material set.
function VariantRow({
  productId,
  variant,
  dimensions,
  incomingQty,
  serialTracked,
}: {
  productId: string;
  variant: VariantDto;
  dimensions: readonly CatalogDimensionConfig[];
  incomingQty: number;
  serialTracked: boolean;
}) {
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast (address-book).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    updateVariantAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        interpolate(label(labelsRef.current, "admin.variants.saved"), { sku: variant.sku }),
      );
    }
  }, [state, variant.sku]);

  // One aria pattern for every variant field: "<field label> <sku>" in each language.
  const fieldAria = (fieldLabel: string) =>
    interpolate(label(labels, "admin.variants.fieldAria"), { label: fieldLabel, sku: variant.sku });

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
        {/* Issue #62 (#55): what is on order for this variant (open purchase orders). */}
        {incomingQty > 0 && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {interpolate(label(labels, "admin.variants.incoming"), { qty: incomingQty })}
          </p>
        )}
        {/* Issue #62 (#54): serial-tracked stock lives in the unit ledger, not in the field. */}
        {serialTracked && (
          <Link
            href={`/admin/stock-units?q=${encodeURIComponent(variant.sku)}`}
            className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-sky-400"
          >
            {label(labels, "admin.variants.serials")}
          </Link>
        )}
      </div>
      <label className="space-y-1 text-xs text-muted-foreground">
        {label(labels, "admin.variants.field.priceDelta")}
        <Input
          name="priceDelta"
          type="number"
          step="0.05"
          defaultValue={(variant.priceDeltaCents / 100).toFixed(2)}
          className="h-8 text-sm"
          aria-label={fieldAria(label(labels, "admin.variants.field.priceDelta"))}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        {label(labels, "admin.products.column.stock")}
        <Input
          name="stock"
          type="number"
          min={0}
          defaultValue={variant.stock}
          className="h-8 text-sm"
          aria-label={fieldAria(label(labels, "admin.products.column.stock"))}
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        {label(labels, "admin.variants.field.weight")}
        <Input
          name="weight"
          type="number"
          min={1}
          defaultValue={variant.weightGrams}
          className="h-8 text-sm"
          aria-label={fieldAria(label(labels, "admin.variants.field.weight"))}
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
            aria-label={fieldAria(dimension.label)}
          />
        </label>
      ))}
      <div className="col-span-2 flex items-end sm:col-span-4 lg:col-span-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {label(labels, "admin.action.save")}
        </Button>
      </div>
    </form>
  );
}

export function VariantEditor({
  product,
  dimensions,
  incomingBySku = {},
  serialTracked = false,
}: {
  product: ProductDto;
  dimensions: readonly CatalogDimensionConfig[];
  incomingBySku?: Record<string, number>;
  serialTracked?: boolean;
}) {
  return (
    <div className="rounded-xl border">
      {product.variants.map((variant) => (
        <VariantRow
          key={variant.sku}
          productId={product.id}
          variant={variant}
          dimensions={dimensions}
          incomingQty={incomingBySku[variant.sku] ?? 0}
          serialTracked={serialTracked}
        />
      ))}
    </div>
  );
}
