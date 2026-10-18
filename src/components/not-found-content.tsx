import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { label } from "@/lib/i18n";

// Issue #58 step 2: one 404 content for both root layouts (storefront per language,
// admin); the wrappers pass the localized home/listing targets and the label map of
// the request language — the copy itself is table text (#58 review: the global
// /_not-found must not answer German on French URLs).
export function NotFoundContent({
  homeHref,
  listingHref,
  labels,
}: {
  homeHref: string;
  listingHref: string;
  labels: Record<string, string>;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        {label(labels, "shop.meta.notFound.title")}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">{label(labels, "shop.notFound.body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href={homeHref}>{label(labels, "shop.notFound.home")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={listingHref}>{label(labels, "shop.notFound.listing")}</Link>
        </Button>
      </div>
    </main>
  );
}
