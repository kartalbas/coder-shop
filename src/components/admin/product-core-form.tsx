"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { label } from "@/lib/i18n";
import {
  toggleFeaturedAction,
  updateProductAction,
  type ProductActionState,
} from "@/server/actions/admin/products";
import type { ProductDto } from "@/server/search";

export function ProductCoreForm({ product }: { product: ProductDto }) {
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast (address-book).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const formId = useId();
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    updateProductAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(label(labelsRef.current, "admin.products.saved"));
  }, [state]);

  const handleSubmit = (formData: FormData) => {
    const payload = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      brand: String(formData.get("brand") ?? ""),
      priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    };
    formData.set("payload", JSON.stringify(payload));
    return formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={product.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${formId}-name`}>{label(labels, "admin.field.name")}</Label>
          <Input id={`${formId}-name`} name="name" defaultValue={product.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-brand`}>{label(labels, "admin.products.column.brand")}</Label>
          <Input id={`${formId}-brand`} name="brand" defaultValue={product.brand} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-price`}>{label(labels, "admin.products.field.price")}</Label>
          <Input
            id={`${formId}-price`}
            name="price"
            type="number"
            step="0.05"
            min={0}
            defaultValue={(product.priceCents / 100).toFixed(2)}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${formId}-description`}>{label(labels, "shop.product.description")}</Label>
          <textarea
            id={`${formId}-description`}
            name="description"
            rows={4}
            defaultValue={product.description}
            required
            minLength={10}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "admin.action.save")}
      </Button>
    </form>
  );
}

export function FeaturedToggle({ productId, featured }: { productId: string; featured: boolean }) {
  const labels = useLabels();
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    toggleFeaturedAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" size="sm" variant={featured ? "default" : "outline"} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Star className="size-4" aria-hidden />
        )}
        {featured ? label(labels, "admin.products.featuredRemove") : label(labels, "admin.products.featuredAdd")}
      </Button>
    </form>
  );
}
