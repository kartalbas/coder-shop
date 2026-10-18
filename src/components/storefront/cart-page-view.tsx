"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductImage } from "@/components/storefront/product-image";
import { DiscountInput } from "@/components/storefront/discount-input";
import { useFormatters } from "@/components/storefront/locale-formatters";
import { FreeShippingProgress } from "@/components/storefront/free-shipping-progress";
import { useShopSettings } from "@/components/shop-settings-provider";
import { interpolate, label } from "@/lib/i18n";
import { activeShippingMethods, vatLabel } from "@/lib/shop-settings";
import {
  cartSubtotalCents,
  removeLine,
  updateQty,
  useCart,
  useCartHydrated,
} from "@/stores/cart";

// Issue #58 step 3: the cart page's texts come from the translation table, handed down
// by the page as a plain label map resolved to the request language.
export function CartPageView({ labels }: { labels: Record<string, string> }) {
  const { chf } = useFormatters();
  const cart = useCart();
  const hydrated = useCartHydrated();
  const settings = useShopSettings();
  const subtotal = cartSubtotalCents(cart);

  // Issue #27: until the persisted cart is loaded, neither the cart nor the empty
  // state may render — that swap was the visible flash.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBag className="size-12 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-bold">{label(labels, "shop.cart.emptyPage")}</h1>
        <p className="text-muted-foreground">{label(labels, "shop.cart.emptySubtitle")}</p>
        <Button asChild size="lg">
          <Link href="/products">{label(labels, "shop.action.continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {label(labels, "shop.cart.title")}
      </h1>
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
                          href={`/products/${line.slug}`}
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
                        aria-label={interpolate(label(labels, "shop.cart.remove"), {
                          name: line.name,
                        })}
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
                          aria-label={interpolate(label(labels, "shop.cart.decrease"), {
                            name: line.name,
                          })}
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
                          aria-label={interpolate(label(labels, "shop.cart.increase"), {
                            name: line.name,
                          })}
                          disabled={line.qty >= line.stock}
                          onClick={() => updateQty(line.sku, line.qty + 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{chf(line.unitPriceCents * line.qty)}</p>
                        {line.qty >= line.stock && (
                          <p className="text-xs text-destructive">
                            {interpolate(label(labels, "shop.cart.maxStock"), {
                              max: line.stock,
                            })}
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
              <h2 className="font-semibold">{label(labels, "shop.cart.summary")}</h2>
              <FreeShippingProgress subtotalCents={subtotal} labels={labels} />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{label(labels, "shop.cart.subtotal")}</span>
                <span className="text-lg font-semibold">{chf(subtotal)}</span>
              </div>
              {/* Issue #45: the code is remembered here and applied in the checkout. */}
              <DiscountInput subtotalCents={subtotal} labels={labels} />
              <p className="text-xs text-muted-foreground">
                {interpolate(label(labels, "shop.cart.summaryNote"), {
                  shipping: activeShippingMethods(settings)
                    .filter((method) => !method.storePickup)
                    .map((method) => `${method.label} ${chf(method.priceCents)}`)
                    .join(", "),
                  amount: chf(settings.freeShippingFromCents),
                  vat: vatLabel(settings.vatRatePercent),
                })}
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/checkout">{label(labels, "shop.action.checkout")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/products">{label(labels, "shop.action.continueShopping")}</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
