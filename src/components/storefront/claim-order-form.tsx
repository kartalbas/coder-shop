"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimOrderAction, type AccountActionState } from "@/server/actions/account";

// Guest orders join the account once the buyer proves the order's e-mail (issue #39).
export function ClaimOrderForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    claimOrderAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? "Bestellung hinzugefügt");
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Bestellung hinzufügen
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="claim-orderNumber">Bestellnummer</Label>
        <Input id="claim-orderNumber" name="orderNumber" placeholder="B-2026-000001" required />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="claim-email">E-Mail der Bestellung</Label>
        <Input id="claim-email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Hinzufügen
      </Button>
    </form>
  );
}
