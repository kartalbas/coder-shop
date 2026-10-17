"use client";

import { useActionState, useEffect } from "react";
import { Loader2, PackageCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markPurchaseOrderOrderedAction,
  receivePurchaseOrderAction,
  type PurchasingActionState,
} from "@/server/actions/admin/purchasing";

type ReceiveState = PurchasingActionState & { summary?: string };

export function MarkOrderedButton({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState<PurchasingActionState | null, FormData>(
    markPurchaseOrderOrderedAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Bestellung als bestellt markiert.");
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="poId" value={poId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        <Send className="size-4" aria-hidden />
        Bestellen
      </Button>
    </form>
  );
}

export function ReceiveButton({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState<ReceiveState | null, FormData>(
    receivePurchaseOrderAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(`Wareneingang gebucht${state.summary ? `: ${state.summary}` : ""}`);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="poId" value={poId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        <PackageCheck className="size-4" aria-hidden />
        Wareneingang
      </Button>
    </form>
  );
}
