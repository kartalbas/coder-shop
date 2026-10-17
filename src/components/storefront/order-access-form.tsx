"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  verifyOrderEmailAction,
  type OrderAccessActionState,
} from "@/server/actions/order-access";

export function OrderAccessForm({ orderNumber }: { orderNumber: string }) {
  const [state, formAction, pending] = useActionState<OrderAccessActionState | null, FormData>(
    verifyOrderEmailAction,
    null,
  );

  return (
    <div className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="font-medium">Bestellung bestätigen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aus Datenschutzgründen zeigen wir die Details zu{" "}
            <span className="font-medium text-foreground">{orderNumber}</span> nur der
            Käuferin oder dem Käufer. Bitte geben Sie die E-Mail-Adresse ein, mit der Sie
            bestellt haben.
          </p>
        </div>
      </div>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <div className="flex-1 space-y-2">
          <Label htmlFor="order-email">E-Mail-Adresse</Label>
          <Input
            id="order-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="sie@beispiel.ch"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Bestellung anzeigen
        </Button>
      </form>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
