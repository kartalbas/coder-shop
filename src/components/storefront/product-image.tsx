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
export function ProductImage({ src, alt, className, loading = "lazy" }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!isPhotoSrc(src) || failedSrc === src) {
    return <Placeholder alt={alt} className={className} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
