"use client";

import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart, openCartDrawer } from "@/stores/cart";
import { reorderAction } from "@/server/actions/account";

// "Erneut bestellen": asks the server for today's prices/stock of the ordered SKUs and
// puts the available ones into the cart.
export function ReorderButton({ orderNumber }: { orderNumber: string }) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const lines = await reorderAction(orderNumber);
      const available = lines.filter((line) => line.available);
      if (available.length === 0) {
        toast.error("Keiner dieser Artikel ist aktuell verfügbar.");
        return;
      }
      for (const line of available) {
        addToCart(
          {
            productId: line.productId,
            slug: line.slug,
            sku: line.sku,
            name: line.name,
            variantLabel: line.variantLabel,
            imageSrc: line.imageSrc,
            unitPriceCents: line.unitPriceCents,
            stock: line.qty,
          },
          line.qty,
        );
      }
      const skipped = lines.length - available.length;
      toast.success(
        `${available.length} ${available.length === 1 ? "Artikel" : "Artikel"} im Warenkorb`,
        { description: skipped > 0 ? `${skipped} nicht mehr verfügbar.` : undefined },
      );
      openCartDrawer();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Repeat className="size-3.5" aria-hidden />
      )}
      Erneut bestellen
    </Button>
  );
}
