import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderStatus } from "@/lib/orders/state-machine";
import { cn } from "@/lib/utils";

export interface StatusLogEntryView {
  status: OrderStatus;
  at: Date | string;
  note?: string;
  by?: string;
}

export function StatusTimeline({ entries }: { entries: StatusLogEntryView[] }) {
  return (
    <ol className="space-y-3" aria-label="Statusverlauf">
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
              <p className="text-sm font-medium">{STATUS_LABELS[entry.status]}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(at)}</p>
              {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
