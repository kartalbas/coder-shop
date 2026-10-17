"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeWishlistItemAction } from "@/server/actions/wishlist";
import { removeFromWishlist } from "@/stores/wishlist";

// Remove one product from the wishlist in the portal (issue #46): the account copy on
// the server and the local mirror both, then the server-rendered list re-renders.
export function WishlistRemoveButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      // No aria-label on purpose: the visible text is the accessible name, and a label
      // here would collide with the heart button's ("… von der Wunschliste entfernen").
      onClick={async () => {
        setPending(true);
        const result = await removeWishlistItemAction(slug);
        if (result.ok) {
          removeFromWishlist(slug);
          router.refresh();
        } else {
          toast.error("Das Entfernen hat nicht funktioniert. Bitte erneut versuchen.");
        }
        setPending(false);
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" aria-hidden />}
      Entfernen
    </Button>
  );
}
