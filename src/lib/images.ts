const PHOTO_SRC = /\.(?:webp|jpe?g|png|avif)$/i;

export function isPhotoSrc(src: string): boolean {
  return PHOTO_SRC.test(src);
}
