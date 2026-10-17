import { formatChf } from "@/lib/format";
import { freeShippingProgress } from "@/lib/pricing";
import { useShopSettings } from "@/components/shop-settings-provider";

// The free-shipping progress bar, shared by the cart drawer and the cart page (issue #30);
// the rule itself is `freeShippingProgress` in src/lib/pricing.ts over the configured
// threshold (issue #64).
export function FreeShippingProgress({ subtotalCents }: { subtotalCents: number }) {
  const settings = useShopSettings();
  const { remainingCents, percent } = freeShippingProgress(subtotalCents, settings);
  return (
    <div>
      {remainingCents > 0 ? (
        <p className="mb-1.5 text-sm text-muted-foreground">
          Noch {formatChf(remainingCents)} bis zum kostenlosen Versand
        </p>
      ) : (
        <p className="mb-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Kostenloser Versand gesichert
        </p>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Fortschritt bis zum kostenlosen Versand"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
