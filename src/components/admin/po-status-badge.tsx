import { Badge } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/models/purchase-order";
import { label } from "@/lib/i18n";

// Issue #26: 600 tones failed axe contrast on the light background — 700 reaches 4.5:1.
const TONES: Record<PurchaseOrderStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  ordered: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  received: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

// Issue #58 step 4: the status copy is `admin.po.status.<status>` from the translation
// table — the page passes its request language's label map.
export function PurchaseOrderStatusBadge({
  status,
  labels,
}: {
  status: PurchaseOrderStatus;
  labels: Record<string, string>;
}) {
  return (
    <Badge variant="outline" className={TONES[status]}>
      {label(labels, `admin.po.status.${status}`)}
    </Badge>
  );
}
