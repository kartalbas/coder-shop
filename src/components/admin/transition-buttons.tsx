"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/orders/labels";
import type { OrderStatus } from "@/lib/orders/state-machine";
import {
  transitionOrderAction,
  type TransitionActionState,
} from "@/server/actions/admin/orders";

const VARIANTS: Partial<Record<OrderStatus, "default" | "outline" | "destructive">> = {
  cancelled: "destructive",
  delivered: "outline",
  picking: "outline",
};

export function TransitionButtons({
  orderId,
  targets,
}: {
  orderId: string;
  targets: readonly OrderStatus[];
}) {
  const [state, formAction, pending] = useActionState<TransitionActionState | null, FormData>(
    transitionOrderAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Status aktualisiert.");
  }, [state]);

  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine weiteren Übergänge möglich.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((target) => (
        <form key={target} action={formAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value={target} />
          <Button
            type="submit"
            size="sm"
            variant={VARIANTS[target] ?? "default"}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {target === "cancelled" ? "Stornieren" : `→ ${STATUS_LABELS[target]}`}
          </Button>
        </form>
      ))}
    </div>
  );
}
