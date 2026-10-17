"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  recordInvoicePaymentAction,
  sendInvoiceReminderAction,
  setCreditLimitAction,
  type InvoiceActionState,
} from "@/server/actions/admin/invoices";

// The toasts fire from the resolved action result, not from a useEffect on the form:
// a successful payment revalidates the list and unmounts the row's form in the same
// commit, so an effect-based toast would never run.
type InvoiceAction = (
  previous: InvoiceActionState | null,
  formData: FormData,
) => Promise<InvoiceActionState>;

function ActionForm({
  action,
  success,
  label,
  className,
  children,
}: {
  action: InvoiceAction;
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
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {label}
      </Button>
    </form>
  );
}

export function InvoicePaymentForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm
      action={recordInvoicePaymentAction}
      success="Zahlung erfasst."
      label="Zahlen"
      className="flex items-center gap-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Input
        name="amount"
        inputMode="decimal"
        placeholder="Betrag CHF"
        aria-label="Betrag in CHF"
        className="h-8 w-28"
        required
      />
    </ActionForm>
  );
}

export function ReminderButtons({
  orderId,
  hasReminder1,
  hasReminder2,
}: {
  orderId: string;
  hasReminder1: boolean;
  hasReminder2: boolean;
}) {
  const withLevel = (level: "1" | "2"): InvoiceAction => (_prev, formData) => {
    formData.set("level", level);
    return sendInvoiceReminderAction(_prev, formData);
  };
  return (
    <span className="flex items-center gap-2">
      {!hasReminder1 && (
        <ActionForm
          action={withLevel("1")}
          success="1. Mahnung verschickt."
          label="1. Mahnung"
        >
          <input type="hidden" name="orderId" value={orderId} />
        </ActionForm>
      )}
      {hasReminder1 && !hasReminder2 && (
        <ActionForm
          action={withLevel("2")}
          success="2. Mahnung verschickt."
          label="2. Mahnung"
        >
          <input type="hidden" name="orderId" value={orderId} />
        </ActionForm>
      )}
    </span>
  );
}

export function CreditLimitForm({
  userId,
  currentCents,
}: {
  userId: string;
  currentCents: number;
}) {
  return (
    <ActionForm
      action={setCreditLimitAction}
      success="Kreditlimit aktualisiert."
      label="Setzen"
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="amount"
        defaultValue={(currentCents / 100).toFixed(2)}
        inputMode="decimal"
        aria-label="Kreditlimit in CHF"
        className="h-8 w-28"
        required
      />
    </ActionForm>
  );
}
