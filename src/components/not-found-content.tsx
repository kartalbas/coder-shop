import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Issue #58 step 2: one German 404 content for both root layouts (storefront per
// language, admin); the wrappers pass the localized home/listing targets.
export function NotFoundContent({
  homeHref,
  listingHref,
}: {
  homeHref: string;
  listingHref: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Seite nicht gefunden</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Diese Seite existiert nicht oder wurde verschoben. Versuchen Sie die Suche oder
        stöbern Sie im Sortiment.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href={homeHref}>Zur Startseite</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={listingHref}>Zum Sortiment</Link>
        </Button>
      </div>
    </main>
  );
}
