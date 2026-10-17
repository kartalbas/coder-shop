"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  handoverPickupAction,
  markPickupReadyAction,
  type PickupActionState,
} from "@/server/actions/admin/pickup";

type PickupAction = (
  previous: PickupActionState | null,
  formData: FormData,
) => Promise<PickupActionState>;

function PickupForm({
  action,
  success,
  label,
  className,
  children,
}: {
  action: PickupAction;
  success: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        startTransition(async () => {
          const result = await action(null, formData);
          if (result.error) toast.error(result.error);
          else toast.success(success);
        });
      }}
    >
      {children}
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {label}
      </Button>
    </form>
  );
}

export function MarkReadyForm({ orderId }: { orderId: string }) {
  return (
    <PickupForm
      action={markPickupReadyAction}
      success="Bereit zur Abholung."
      label="Bereit zur Abholung"
    >
      <input type="hidden" name="orderId" value={orderId} />
    </PickupForm>
  );
}

// Handover at the counter (issue #41): staff enters the customer's code, picks how the
// money was taken, and the order moves to "abgeholt" with the payment recorded.
export function HandoverForm({ orderId }: { orderId: string }) {
  return (
    <PickupForm
      action={handoverPickupAction}
      success="Abgeholt und bezahlt."
      label="Übergeben & bezahlen"
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Input
        name="code"
        placeholder="Abholcode"
        aria-label="Abholcode"
        autoComplete="off"
        className="h-8 w-32 font-mono uppercase"
        required
      />
      <label className="flex items-center gap-1 text-sm">
        <input type="radio" name="paymentType" value="cash" defaultChecked className="size-4 accent-primary" />
        Bar
      </label>
      <label className="flex items-center gap-1 text-sm">
        <input type="radio" name="paymentType" value="card" className="size-4 accent-primary" />
        Karte
      </label>
    </PickupForm>
  );
}
