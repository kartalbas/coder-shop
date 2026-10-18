"use client";

import { ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { interpolate, label } from "@/lib/i18n";
import { cartCount, openCartDrawer, useCart } from "@/stores/cart";

// Issue #58 step 3: the aria label is a translation-table text of the request language;
// the test id keeps the drawer reachable without selecting a label in any one language.
export function CartButton({ labels }: { labels: Readonly<Record<string, string>> }) {
  const cart = useCart();
  const count = cartCount(cart);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      data-testid="cart-button"
      aria-label={interpolate(label(labels, "shop.header.cart"), { count: String(count) })}
      onClick={openCartDrawer}
    >
      <ShoppingCart className="size-4" />
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
        >
          {count}
        </motion.span>
      )}
    </Button>
  );
}
