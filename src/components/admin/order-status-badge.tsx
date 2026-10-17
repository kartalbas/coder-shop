import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderStatus } from "@/lib/orders/state-machine";

const TONES: Partial<Record<OrderStatus, string>> = {
  new: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  paid: "bg-primary/10 text-primary border-primary/30",
  picking: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  packed: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={TONES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
