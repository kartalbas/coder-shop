import { Check, Circle, X } from "lucide-react";
import { createFormatters } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/orders/labels";
import { HAPPY_PATH, type OrderStatus } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";

export interface OrderChainEntry {
  status: OrderStatus;
  at: Date | string;
}

// Horizontal happy-path chain for the customer confirmation (the admin uses the vertical
// StatusTimeline). Lives in components so the route file stays thin (issue #32).
export function OrderStatusChain({
  status,
  statusLog,
  path = HAPPY_PATH,
  intlLocale,
}: {
  status: OrderStatus;
  statusLog: OrderChainEntry[];
  // The milestone chain to render — HAPPY_PATH for parcels, PICKUP_PATH for store
  // collection (issue #41).
  path?: readonly OrderStatus[];
  // Issue #58 step 2b: the timestamps follow the request language's Intl locale.
  intlLocale: string;
}) {
  const { dateTime } = createFormatters(intlLocale);
  const reached = new Set(statusLog.map((entry) => entry.status));
  if (status === "cancelled") {
    const cancelledAt = statusLog.find((entry) => entry.status === "cancelled");
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <X className="size-5 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="font-medium text-destructive">Bestellung storniert</p>
          {cancelledAt && (
            <p className="text-sm text-muted-foreground">
              am {dateTime(new Date(cancelledAt.at))}
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <ol className="flex flex-wrap gap-y-3" aria-label="Bestellstatus">
      {path.map((step, index) => {
        const done = reached.has(step);
        const entry = statusLog.find((e) => e.status === step);
        return (
          <li key={step} className="flex items-center">
            {index > 0 && <span className="mx-2 h-px w-6 bg-border sm:w-10" aria-hidden />}
            <div className="flex flex-col items-center gap-1 text-center">
              {done ? (
                <Check className="size-5 text-primary" aria-hidden />
              ) : (
                <Circle className="size-5 text-muted-foreground/40" aria-hidden />
              )}
              <span
                className={cn(
                  "text-xs",
                  done ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {STATUS_LABELS[step]}
              </span>
              {entry && (
                <span className="text-[10px] text-muted-foreground">
                  {dateTime(new Date(entry.at))}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
