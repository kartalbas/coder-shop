import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPhotoSrc } from "@/lib/images";

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

export function ProductImage({ src, alt, className, loading = "lazy" }: ProductImageProps) {
  if (!isPhotoSrc(src)) {
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
  return <img src={src} alt={alt} loading={loading} className={className} />;
}
