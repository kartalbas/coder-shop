import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
          <Link href="/">Zur Startseite</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Zum Sortiment</Link>
        </Button>
      </div>
    </main>
  );
}
