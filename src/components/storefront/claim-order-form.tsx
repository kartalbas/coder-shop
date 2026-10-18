"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { label } from "@/lib/i18n";
import { useLabels } from "@/components/storefront/labels";
import { claimOrderAction, type AccountActionState } from "@/server/actions/account";

// Guest orders join the account once the buyer proves the order's e-mail (issue #39).
export function ClaimOrderForm() {
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast.
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    claimOrderAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? label(labelsRef.current, "shop.account.claim.added"));
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label(labels, "shop.account.claim.add")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="claim-orderNumber">{label(labels, "shop.account.claim.orderNumber")}</Label>
        <Input id="claim-orderNumber" name="orderNumber" placeholder="B-2026-000001" required />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="claim-email">{label(labels, "shop.account.claim.email")}</Label>
        <Input id="claim-email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.action.add")}
      </Button>
    </form>
  );
}
