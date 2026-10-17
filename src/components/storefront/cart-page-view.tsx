"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/components/storefront/product-image";
import { formatChf } from "@/lib/format";
import {
  FREE_SHIPPING_FROM_CENTS,
  SHIPPING_CENTS,
} from "@/lib/pricing";
import {
  cartSubtotalCents,
  removeLine,
  updateQty,
  useCart,
} from "@/stores/cart";

export function CartPageView() {
  const cart = useCart();
  const subtotal = cartSubtotalCents(cart);
  const remaining = Math.max(0, FREE_SHIPPING_FROM_CENTS - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_FROM_CENTS) * 100);

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBag className="size-12 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold">Ihr Warenkorb ist leer</h1>
        <p className="text-muted-foreground">
          Entdecken Sie unser Sortiment an Smartphones, Schuhen und Kleidung.
        </p>
        <Button asChild size="lg">
          <Link href="/produkte">Weiter einkaufen</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Warenkorb</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-4">
          {cart.lines.map((line) => (
            <li key={line.sku}>
              <Card>
                <CardContent className="flex gap-4 p-4">
                  <ProductImage
                    src={line.imageSrc}
                    alt=""
                    className="size-20 shrink-0 rounded-lg border object-contain sm:size-24"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/produkt/${line.slug}`}
                          className="block truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {line.name}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground">
                          {line.variantLabel}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground"
                        aria-label={`Entfernen: ${line.name}`}
                        onClick={() => removeLine(line.sku)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Menge verringern: ${line.name}`}
                          onClick={() => updateQty(line.sku, line.qty - 1)}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-10 text-center text-sm font-medium tabular-nums">
                          {line.qty}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Menge erhöhen: ${line.name}`}
                          disabled={line.qty >= line.stock}
                          onClick={() => updateQty(line.sku, line.qty + 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatChf(line.unitPriceCents * line.qty)}</p>
                        {line.qty >= line.stock && (
                          <p className="text-xs text-destructive">
                            Maximal {line.stock} an Lager
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <aside>
          <Card className="lg:sticky lg:top-24">
            <CardContent className="space-y-4 p-5">
              <h2 className="font-semibold">Zusammenfassung</h2>
              <div>
                {remaining > 0 ? (
                  <p className="mb-1.5 text-sm text-muted-foreground">
                    Noch {formatChf(remaining)} bis zum kostenlosen Versand
                  </p>
                ) : (
                  <p className="mb-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Kostenloser Versand gesichert
                  </p>
                )}
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Fortschritt bis zum kostenlosen Versand"
                >
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="text-lg font-semibold">{formatChf(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Versand: Standard {formatChf(SHIPPING_CENTS.standard)}, Express{" "}
                {formatChf(SHIPPING_CENTS.express)} — ab {formatChf(FREE_SHIPPING_FROM_CENTS)}{" "}
                kostenlos. Preise inkl. 8,1 % MwSt.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/kasse">Zur Kasse</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/produkte">Weiter einkaufen</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
