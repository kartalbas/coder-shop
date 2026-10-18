"use client";

import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart, openCartDrawer } from "@/stores/cart";
import { interpolate, label } from "@/lib/i18n";
import { useLabels } from "@/components/storefront/labels";
import { reorderAction } from "@/server/actions/account";

// "Erneut bestellen": asks the server for today's prices/stock of the ordered SKUs and
// puts the available ones into the cart.
export function ReorderButton({ orderNumber }: { orderNumber: string }) {
  const labels = useLabels();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const lines = await reorderAction(orderNumber);
      const available = lines.filter((line) => line.available);
      if (available.length === 0) {
        toast.error(label(labels, "shop.account.reorder.noneAvailable"));
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
        interpolate(label(labels, "shop.account.reorder.added"), { count: available.length }),
        {
          description:
            skipped > 0
              ? interpolate(label(labels, "shop.account.reorder.skipped"), { count: skipped })
              : undefined,
        },
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
      {label(labels, "shop.account.reorder.action")}
    </Button>
  );
}
