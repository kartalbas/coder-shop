"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPhotoSrc } from "@/lib/images";

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Layout width hint for srcset selection (issue #25), e.g. "256px" or "50vw". */
  sizes?: string;
}

// Issue #25: the photos on disk are 768 px; cards and thumbnails must not download them
// full-size. The srcset lets the browser pick a slot-sized variant from the image
// optimizer (widths allowed by the Next defaults).
const OPTIMIZED_WIDTHS = [128, 256, 384, 640] as const;
const DEFAULT_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 256px";

function srcSetFor(src: string): string {
  return OPTIMIZED_WIDTHS.map(
    (width) => `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75 ${width}w`,
  ).join(", ");
}

function Placeholder({ alt, className }: { alt: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("flex items-center justify-center bg-muted", className)}
    >
      <ImageOff className="h-1/3 w-1/3 text-muted-foreground/40" aria-hidden />
    </div>
  );
}

// Photo paths are recorded by the seed before the photo exists (issue #29), so a missing
// file is the normal state until `npm run images` fills the slot: any non-photo src and
// any photo that fails to load renders the neutral placeholder.
export function ProductImage({
  src,
  alt,
  className,
  loading = "lazy",
  sizes = DEFAULT_SIZES,
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!isPhotoSrc(src) || failedSrc === src) {
    return <Placeholder alt={alt} className={className} />;
  }
  return (
    <img
      src={src}
      srcSet={srcSetFor(src)}
      sizes={sizes}
      alt={alt}
      loading={loading}
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
