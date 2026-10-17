"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/storefront/product-image";
import { updateImagesAction, type ProductActionState } from "@/server/actions/admin/products";
import { MAX_PRODUCT_IMAGES, MIN_PRODUCT_IMAGES } from "@/lib/validations/product";
import type { ProductDto } from "@/server/search";

interface ImageRow {
  src: string;
  alt: string;
}

export function ImageEditor({ product }: { product: ProductDto }) {
  const [images, setImages] = useState<ImageRow[]>(() =>
    product.images.map((image) => ({ src: image.src, alt: image.alt })),
  );
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    updateImagesAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Bilder gespeichert.");
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
              alt={image.alt || "Bildvorschau"}
              className="size-20 shrink-0 rounded-lg border object-cover"
            />
            <label className="min-w-40 flex-1 space-y-1 text-xs text-muted-foreground">
              Pfad (z. B. /products/{product.slug}-1.webp)
              <Input
                value={image.src}
                onChange={(event) => update(index, { src: event.target.value })}
                placeholder={`/products/${product.slug}-1.webp`}
                className="h-8 text-sm"
                aria-label={`Bildpfad ${index + 1}`}
              />
            </label>
            <label className="min-w-40 flex-1 space-y-1 text-xs text-muted-foreground">
              Alt-Text
              <Input
                value={image.alt}
                onChange={(event) => update(index, { alt: event.target.value })}
                placeholder="Beschreibung des Bildes"
                className="h-8 text-sm"
                aria-label={`Alt-Text ${index + 1}`}
              />
            </label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Bild ${index + 1} nach oben`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Bild ${index + 1} nach unten`}
                disabled={index === images.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Bild ${index + 1} entfernen`}
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
          Bild hinzufügen
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Bilder speichern
        </Button>
        <p className="text-xs text-muted-foreground">
          {images.length} von {MAX_PRODUCT_IMAGES} Bildern · Fotos erzeugt das Bild-Tool
          (<code>npm run images</code>); hier werden Reihenfolge, Pfade und Alt-Texte gepflegt.
        </p>
      </div>
    </form>
  );
}
