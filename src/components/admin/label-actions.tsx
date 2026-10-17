"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createLabelAction,
  type CreateLabelActionState,
} from "@/server/actions/admin/shipping";

export function LabelButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<CreateLabelActionState | null, FormData>(
    createLabelAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(`Etikett erstellt — Sendung ${state.trackingNumber}`);
  }, [state]);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        UPS-Etikett erstellen
      </Button>
      {state?.ok && (
        <span className="text-sm text-muted-foreground">
          Sendung {state.trackingNumber} ·{" "}
          <Link
            href={`/admin/labels/${orderId}`}
            target="_blank"
            className="inline-flex items-center gap-1 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Etikett öffnen <ExternalLink className="size-3" aria-hidden />
          </Link>
        </span>
      )}
    </form>
  );
}

export function PrintButton() {
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      Drucken
    </Button>
  );
}
