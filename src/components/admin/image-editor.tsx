"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/storefront/product-image";
import { updateImagesAction, type ProductActionState } from "@/server/actions/admin/products";
import { interpolate, label, splitOnPlaceholder } from "@/lib/i18n";
import { MAX_PRODUCT_IMAGES, MIN_PRODUCT_IMAGES } from "@/lib/validations/product";
import type { ProductDto } from "@/server/search";

interface ImageRow {
  src: string;
  alt: string;
}

export function ImageEditor({ product }: { product: ProductDto }) {
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast (address-book).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [images, setImages] = useState<ImageRow[]>(() =>
    product.images.map((image) => ({ src: image.src, alt: image.alt })),
  );
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    updateImagesAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(label(labelsRef.current, "admin.images.saved"));
  }, [state]);

  const update = (index: number, patch: Partial<ImageRow>) =>
    setImages((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const move = (index: number, direction: -1 | 1) =>
    setImages((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (index: number) =>
    setImages((rows) => rows.filter((_, i) => i !== index));

  const add = () =>
    setImages((rows) => [...rows, { src: "", alt: "" }]);

  const handleSubmit = (formData: FormData) => {
    formData.set("payload", JSON.stringify({ images }));
    return formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={product.id} />
      <ul className="space-y-3">
        {images.map((image, index) => (
          <li
            key={index}
            className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3"
          >
            <ProductImage
              src={image.src}
              alt={image.alt || label(labels, "admin.images.preview")}
              className="size-20 shrink-0 rounded-lg border object-cover"
            />
            <label className="min-w-40 flex-1 space-y-1 text-xs text-muted-foreground">
              {interpolate(label(labels, "admin.images.pathLabel"), {
                example: `/products/${product.slug}-1.webp`,
              })}
              <Input
                value={image.src}
                onChange={(event) => update(index, { src: event.target.value })}
                placeholder={`/products/${product.slug}-1.webp`}
                className="h-8 text-sm"
                aria-label={interpolate(label(labels, "admin.images.pathAria"), { index: index + 1 })}
              />
            </label>
            <label className="min-w-40 flex-1 space-y-1 text-xs text-muted-foreground">
              {label(labels, "admin.images.altLabel")}
              <Input
                value={image.alt}
                onChange={(event) => update(index, { alt: event.target.value })}
                placeholder={label(labels, "admin.images.altPlaceholder")}
                className="h-8 text-sm"
                aria-label={interpolate(label(labels, "admin.images.altAria"), { index: index + 1 })}
              />
            </label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={interpolate(label(labels, "admin.images.moveUp"), { index: index + 1 })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={interpolate(label(labels, "admin.images.moveDown"), { index: index + 1 })}
                disabled={index === images.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={interpolate(label(labels, "admin.images.remove"), { index: index + 1 })}
                disabled={images.length <= MIN_PRODUCT_IMAGES}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={images.length >= MAX_PRODUCT_IMAGES}
        >
          <ImagePlus className="size-4" aria-hidden />
          {label(labels, "admin.images.add")}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {label(labels, "admin.images.save")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {(() => {
            const note = splitOnPlaceholder(
              interpolate(label(labels, "admin.images.note"), {
                count: images.length,
                max: MAX_PRODUCT_IMAGES,
              }),
              "code",
            );
            return (
              <>
                {note.before}
                <code>npm run images</code>
                {note.after}
              </>
            );
          })()}
        </p>
      </div>
    </form>
  );
}
