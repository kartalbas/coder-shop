"use client";

import { ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cartCount, openCartDrawer, useCart } from "@/stores/cart";

export function CartButton() {
  const cart = useCart();
  const count = cartCount(cart);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={`Warenkorb, ${count} Artikel`}
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
