"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatChf } from "@/lib/format";
import { FREE_SHIPPING_FROM_CENTS } from "@/lib/pricing";
import {
  cartSubtotalCents,
  closeCartDrawer,
  removeLine,
  updateQty,
  useCart,
  useCartDrawerOpen,
} from "@/stores/cart";

export function CartDrawer() {
  const open = useCartDrawerOpen();
  const cart = useCart();
  const subtotal = cartSubtotalCents(cart);
  const remaining = Math.max(0, FREE_SHIPPING_FROM_CENTS - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_FROM_CENTS) * 100);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : closeCartDrawer())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Warenkorb</SheetTitle>
        </SheetHeader>
        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Ihr Warenkorb ist leer.</p>
            <Button asChild variant="outline">
              <Link href="/produkte" onClick={closeCartDrawer}>Weiter einkaufen</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {cart.lines.map((line) => (
                <li key={line.sku} className="flex gap-3">
                  <img
                    src={line.imageSrc}
                    alt=""
                    className="size-16 shrink-0 rounded-lg border object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/produkt/${line.slug}`}
                      onClick={closeCartDrawer}
                      className="block truncate text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {line.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{line.variantLabel}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-md border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Menge verringern: ${line.name}`}
                          onClick={() => updateQty(line.sku, line.qty - 1)}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{line.qty}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Menge erhöhen: ${line.name}`}
                          disabled={line.qty >= line.stock}
                          onClick={() => updateQty(line.sku, line.qty + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold">{formatChf(line.unitPriceCents * line.qty)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 self-start text-muted-foreground"
                    aria-label={`Entfernen: ${line.name}`}
                    onClick={() => removeLine(line.sku)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="border-t p-4">
              <div className="mb-3">
                {remaining > 0 ? (
                  <p className="mb-1 text-xs text-muted-foreground">
                    Noch {formatChf(remaining)} bis zum kostenlosen Versand
                  </p>
                ) : (
                  <p className="mb-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Kostenloser Versand gesichert
                  </p>
                )}
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Fortschritt bis zum kostenlosen Versand"
                >
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Zwischensumme</span>
                <span className="text-lg font-semibold">{formatChf(subtotal)}</span>
              </div>
              <Separator className="mb-3" />
              <Button asChild className="w-full" size="lg">
                <Link href="/warenkorb" onClick={closeCartDrawer}>Zur Kasse</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
