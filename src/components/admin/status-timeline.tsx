import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";

export interface StatusLogEntryView {
  status: OrderStatus;
  at: Date | string;
  note?: string;
  by?: string;
}

// Issue #58 step 2: like the badge, the timeline reads `shop.status.<status>` from the
// request language's label map the page hands over — no German base in the component.
export function StatusTimeline({
  entries,
  labels,
}: {
  entries: StatusLogEntryView[];
  labels: Record<string, string>;
}) {
  return (
    <ol className="space-y-3" aria-label={label(labels, "admin.orders.historyAria")}>
      {entries.map((entry, index) => {
        const at = entry.at instanceof Date ? entry.at : new Date(entry.at);
        return (
          <li key={`${entry.status}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-1 size-2.5 rounded-full",
                  index === entries.length - 1 ? "bg-primary" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              {index < entries.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium">{label(labels, `shop.status.${entry.status}`)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(at)}</p>
              {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
