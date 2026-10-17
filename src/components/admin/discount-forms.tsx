"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDiscountAction,
  setDiscountActiveAction,
  type DiscountAdminActionState,
} from "@/server/actions/admin/discounts";

// Issue #45: marketing creates and toggles discount codes.
export function DiscountCreateForm() {
  const [state, formAction, pending] = useActionState<DiscountAdminActionState | null, FormData>(
    createDiscountAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Code angelegt.");
      formRef.current?.reset();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" placeholder="HERBST2026" required className="uppercase" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Beschreibung (intern)</Label>
        <Input id="description" name="description" placeholder="Herbstkampagne" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kind">Art</Label>
        <select
          id="kind"
          name="kind"
          defaultValue="percent"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="percent">Prozent</option>
          <option value="fixed">Festbetrag</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="percent">Prozent (1–100)</Label>
        <Input id="percent" name="percent" type="number" min={1} max={100} defaultValue={10} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amountCents">Festbetrag (CHF)</Label>
        <Input id="amountCents" name="amountCents" inputMode="decimal" placeholder="20.00" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="minOrderCents">Mindestbestellung (CHF)</Label>
        <Input id="minOrderCents" name="minOrderCents" inputMode="decimal" placeholder="50.00" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="validFrom">Gültig von</Label>
        <Input id="validFrom" name="validFrom" type="date" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="validTo">Gültig bis</Label>
        <Input id="validTo" name="validTo" type="date" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="usageLimit">Nutzungslimit (Total)</Label>
        <Input id="usageLimit" name="usageLimit" type="number" min={1} placeholder="unbegrenzt" />
      </div>
      <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
        <input type="checkbox" name="perCustomerOnce" className="size-4 accent-primary" />
        Pro Kunde nur einmal
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Code anlegen
        </Button>
      </div>
    </form>
  );
}

export function DiscountToggle({
  discountId,
  active,
}: {
  discountId: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await setDiscountActiveAction(null, formData);
          if (result.error) toast.error(result.error);
          else toast.success(active ? "Code deaktiviert." : "Code aktiviert.");
        });
      }}
    >
      <input type="hidden" name="discountId" value={discountId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {active ? "Deaktivieren" : "Aktivieren"}
      </Button>
    </form>
  );
}
