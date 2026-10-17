"use client";

import { useActionState, useEffect, useId } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSupplierAction, type PurchasingActionState } from "@/server/actions/admin/purchasing";
import type { Supplier } from "@/models/supplier";

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const formId = useId();
  const [state, formAction, pending] = useActionState<PurchasingActionState | null, FormData>(
    saveSupplierAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(supplier ? "Lieferant gespeichert." : "Lieferant angelegt.");
  }, [state, supplier]);

  return (
    <form action={formAction} className="space-y-3">
      {supplier && <input type="hidden" name="supplierId" value={supplier._id.toString()} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-name`}>Name</Label>
          <Input
            id={`${formId}-name`}
            name="name"
            defaultValue={supplier?.name}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-email`}>E-Mail</Label>
          <Input
            id={`${formId}-email`}
            name="email"
            type="email"
            defaultValue={supplier?.email}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-phone`}>Telefon (optional)</Label>
          <Input id={`${formId}-phone`} name="phone" defaultValue={supplier?.phone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-lead`}>Lieferzeit (Tage)</Label>
          <Input
            id={`${formId}-lead`}
            name="leadTimeDays"
            type="number"
            min={0}
            max={365}
            defaultValue={supplier?.leadTimeDays ?? 7}
            required
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={`${formId}-active`}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Checkbox
            id={`${formId}-active`}
            name="active"
            defaultChecked={supplier?.active ?? true}
          />
          Aktiv
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {supplier ? "Speichern" : "Anlegen"}
        </Button>
      </div>
    </form>
  );
}
