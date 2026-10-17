"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/storefront/product-image";
import { cn } from "@/lib/utils";
import { isPhotoSrc } from "@/lib/images";
import type { ProductDto } from "@/server/search";

interface GalleryProps {
  product: ProductDto;
  imageIndex: number;
  onImageChange: (index: number) => void;
}

export function Gallery({ product, imageIndex, onImageChange }: GalleryProps) {
  const images = product.images;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [failedSrcs, setFailedSrcs] = useState<ReadonlySet<string>>(new Set());
  const current = images[Math.min(imageIndex, images.length - 1)];
  // Photo slots exist before the files do (issue #29) — a failed load falls back to the
  // placeholder, exactly like ProductImage does for thumbnails and cards.
  const markFailed = (src: string) =>
    setFailedSrcs((prev) => (prev.has(src) ? prev : new Set([...prev, src])));

  const step = (delta: number) => {
    if (images.length === 0) return;
    onImageChange((imageIndex + delta + images.length) % images.length);
  };

  // Issue #26: a drag must not count as a click-to-zoom.
  const draggedRef = useRef(false);

  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative overflow-hidden rounded-xl border bg-muted">
        <AnimatePresence mode="wait">
          {isPhotoSrc(current.src) && !failedSrcs.has(current.src) ? (
            <motion.img
              key={current.src}
              src={current.src}
              alt={current.alt}
              onError={() => markFailed(current.src)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              // Focusable and keyboard-operable (issue #26) while keeping the img role
              // and its German alt as the accessible name.
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpenIndex(imageIndex);
                }
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragStart={() => {
                draggedRef.current = true;
              }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) step(1);
                else if (info.offset.x > 60) step(-1);
              }}
              onClick={() => {
                if (draggedRef.current) {
                  draggedRef.current = false;
                  return;
                }
                setOpenIndex(imageIndex);
              }}
              className="aspect-square w-full cursor-zoom-in object-contain focus-visible:outline-2 focus-visible:outline-ring"
            />
          ) : (
            <motion.div
              key={current.src}
              role="img"
              aria-label={current.alt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex aspect-square w-full items-center justify-center"
            >
              <ImageOff className="size-16 text-muted-foreground/40" aria-hidden />
            </motion.div>
          )}
        </AnimatePresence>
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
              aria-label="Vorheriges Bild"
              onClick={() => step(-1)}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
              aria-label="Nächstes Bild"
              onClick={() => step(1)}
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              aria-label={`Bild ${index + 1} von ${images.length}: ${image.alt}`}
              aria-current={index === imageIndex}
              onClick={() => onImageChange(index)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg border bg-muted transition-all focus-visible:outline-2 focus-visible:outline-ring",
                index === imageIndex ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
              )}
            >
              <ProductImage
                src={image.src}
                alt=""
                sizes="64px"
                className="size-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          {openIndex !== null && images[openIndex] && (
            <ProductImage
              src={images[openIndex].src}
              alt={images[openIndex].alt}
              loading="eager"
              sizes="(max-width: 768px) 95vw, 768px"
              className="max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
