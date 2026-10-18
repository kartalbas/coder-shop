"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { label } from "@/lib/i18n";
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
  successKey,
  labelKey,
  className,
  children,
}: {
  action: InvoiceAction;
  successKey: string;
  labelKey: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const labels = useLabels();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        startTransition(async () => {
          const result = await action(null, formData);
          if (result.error) toast.error(result.error);
          else toast.success(label(labels, successKey));
        });
      }}
    >
      {children}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {label(labels, labelKey)}
      </Button>
    </form>
  );
}

export function InvoicePaymentForm({ orderId }: { orderId: string }) {
  const labels = useLabels();
  return (
    <ActionForm
      action={recordInvoicePaymentAction}
      successKey="admin.invoices.payToast"
      labelKey="admin.invoices.pay"
      className="flex items-center gap-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Input
        name="amount"
        inputMode="decimal"
        placeholder={label(labels, "admin.invoices.amountPlaceholder")}
        aria-label={label(labels, "admin.invoices.amountAria")}
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
          successKey="admin.invoices.reminder1Toast"
          labelKey="admin.invoices.reminder1"
        >
          <input type="hidden" name="orderId" value={orderId} />
        </ActionForm>
      )}
      {hasReminder1 && !hasReminder2 && (
        <ActionForm
          action={withLevel("2")}
          successKey="admin.invoices.reminder2Toast"
          labelKey="admin.invoices.reminder2"
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
  const labels = useLabels();
  return (
    <ActionForm
      action={setCreditLimitAction}
      successKey="admin.invoices.creditToast"
      labelKey="admin.invoices.creditSet"
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="amount"
        defaultValue={(currentCents / 100).toFixed(2)}
        inputMode="decimal"
        aria-label={label(labels, "admin.invoices.creditLimitAria")}
        className="h-8 w-28"
        required
      />
    </ActionForm>
  );
}
