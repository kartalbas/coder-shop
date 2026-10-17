// Single source for the public origin (issue #28): metadata, JSON-LD and any other
// absolute-URL need derives from it. NEXT_PUBLIC_* is inlined at build time.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
