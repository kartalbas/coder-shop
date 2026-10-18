import { useFormatters } from "@/components/storefront/locale-formatters";
import { freeShippingProgress } from "@/lib/pricing";
import { useShopSettings } from "@/components/shop-settings-provider";
import { interpolate, label } from "@/lib/i18n";

// The free-shipping progress bar, shared by the cart drawer and the cart page (issue #30);
// the rule itself is `freeShippingProgress` in src/lib/pricing.ts over the configured
// threshold (issue #64). The texts are translation-table labels (#58 step 3); the
// amount is interpolated already formatted, so value and locale stay in one place.
export function FreeShippingProgress({
  subtotalCents,
  labels,
}: {
  subtotalCents: number;
  labels: Record<string, string>;
}) {
  const settings = useShopSettings();
  const { chf } = useFormatters();
  const { remainingCents, percent } = freeShippingProgress(subtotalCents, settings);
  return (
    <div>
      {remainingCents > 0 ? (
        <p className="mb-1.5 text-sm text-muted-foreground">
          {interpolate(label(labels, "shop.cart.freeShipping"), {
            amount: chf(remainingCents),
          })}
        </p>
      ) : (
        <p className="mb-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {label(labels, "shop.cart.freeShippingUnlocked")}
        </p>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label(labels, "shop.cart.freeShippingProgress")}
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
