"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductImage } from "@/components/storefront/product-image";
import { useFormatters } from "@/components/locale-formatters";
import { FreeShippingProgress } from "@/components/storefront/free-shipping-progress";
import { interpolate, label } from "@/lib/i18n";
import {
  cartSubtotalCents,
  closeCartDrawer,
  removeLine,
  updateQty,
  useCart,
  useCartDrawerOpen,
} from "@/stores/cart";

// Issue #58 step 3: the drawer's texts come from the translation table, handed down by
// the storefront layout as a plain label map resolved to the request language.
export function CartDrawer({ labels }: { labels: Record<string, string> }) {
  const { chf } = useFormatters();
  const open = useCartDrawerOpen();
  const cart = useCart();
  const subtotal = cartSubtotalCents(cart);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : closeCartDrawer())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{label(labels, "shop.cart.title")}</SheetTitle>
        </SheetHeader>
        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">{label(labels, "shop.cart.emptyDrawer")}</p>
            <Button asChild variant="outline">
              <Link href="/products" onClick={closeCartDrawer}>
                {label(labels, "shop.action.continueShopping")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {cart.lines.map((line) => (
                <li key={line.sku} className="flex gap-3">
                  <ProductImage
                    src={line.imageSrc}
                    alt=""
                    className="size-16 shrink-0 rounded-lg border object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${line.slug}`}
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
                          aria-label={interpolate(label(labels, "shop.cart.decrease"), {
                            name: line.name,
                          })}
                          onClick={() => updateQty(line.sku, line.qty - 1)}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{line.qty}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={interpolate(label(labels, "shop.cart.increase"), {
                            name: line.name,
                          })}
                          disabled={line.qty >= line.stock}
                          onClick={() => updateQty(line.sku, line.qty + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold">{chf(line.unitPriceCents * line.qty)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 self-start text-muted-foreground"
                    aria-label={interpolate(label(labels, "shop.cart.remove"), {
                      name: line.name,
                    })}
                    onClick={() => removeLine(line.sku)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="border-t p-4">
              <div className="mb-3">
                <FreeShippingProgress subtotalCents={subtotal} labels={labels} />
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {label(labels, "shop.cart.subtotal")}
                </span>
                <span className="text-lg font-semibold">{chf(subtotal)}</span>
              </div>
              <Separator className="mb-3" />
              <Button asChild className="w-full" size="lg">
                <Link href="/checkout" onClick={closeCartDrawer}>
                  {label(labels, "shop.action.checkout")}
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
