"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { interpolate, label } from "@/lib/i18n";
import {
  createLabelAction,
  type CreateLabelActionState,
} from "@/server/actions/admin/shipping";

export function LabelButton({ orderId }: { orderId: string }) {
  const labels = useLabels();
  // The toast fires through a ref kept current by an effect so a label sync can never
  // re-fire it (address-book pattern).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [state, formAction, pending] = useActionState<CreateLabelActionState | null, FormData>(
    createLabelAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        interpolate(label(labelsRef.current, "admin.label.created"), {
          tracking: state.trackingNumber ?? "",
        }),
      );
    }
  }, [state]);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "admin.label.create")}
      </Button>
      {state?.ok && (
        <span className="text-sm text-muted-foreground">
          {interpolate(label(labels, "admin.label.shipment"), {
            tracking: state.trackingNumber ?? "",
          })}{" "}
          ·{" "}
          <Link
            href={`/admin/labels/${orderId}`}
            target="_blank"
            className="inline-flex items-center gap-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {label(labels, "admin.label.open")} <ExternalLink className="size-3" aria-hidden />
          </Link>
        </span>
      )}
    </form>
  );
}

export function PrintButton() {
  const labels = useLabels();
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {label(labels, "admin.action.print")}
    </Button>
  );
}
