import { Badge } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/models/purchase-order";
// Issue #35: the German PO copy lives in the pure lib, the component keeps only styling.
import { PO_STATUS_LABELS } from "@/lib/purchasing/labels";

// Issue #26: 600 tones failed axe contrast on the light background — 700 reaches 4.5:1.
const TONES: Record<PurchaseOrderStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  ordered: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  received: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <Badge variant="outline" className={TONES[status]}>
      {PO_STATUS_LABELS[status]}
    </Badge>
  );
}
