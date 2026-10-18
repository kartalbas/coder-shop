"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { label } from "@/lib/i18n";
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
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast (address-book).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [state, formAction, pending] = useActionState<TransitionActionState | null, FormData>(
    transitionOrderAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(label(labelsRef.current, "admin.orders.statusUpdated"));
  }, [state]);

  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{label(labels, "admin.orders.noTransitions")}</p>
    );
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
            {target === "cancelled"
              ? label(labels, "admin.orders.cancel")
              : `→ ${label(labels, `shop.status.${target}`)}`}
          </Button>
        </form>
      ))}
    </div>
  );
}
