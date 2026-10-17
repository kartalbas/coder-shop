import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderStatus } from "@/lib/orders/state-machine";

// Issue #26: 600 tones failed axe contrast on the light background — 700 reaches 4.5:1.
const TONES: Partial<Record<OrderStatus, string>> = {
  new: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  paid: "bg-primary/10 text-primary border-primary/30",
  picking: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  packed: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  shipped: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  ready: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30",
  picked_up: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={TONES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
