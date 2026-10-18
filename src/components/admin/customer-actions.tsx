"use client";

import { useEffect, useRef, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";
import {
  adminResetPasswordAction,
  setCustomerBlockedAction,
  setCustomerNotesAction,
  type CustomerActionState,
} from "@/server/actions/admin/customers";

// Issue #43: block/unblock, internal notes and the admin-initiated password reset.
// Same toast-on-resolved-result pattern as the invoice actions; #58 step 5 reads the
// texts from the table, the toast label through the address-book ref pattern.
type CustomerAction = (
  previous: CustomerActionState | null,
  formData: FormData,
) => Promise<CustomerActionState>;

function ActionForm({
  action,
  successKey,
  labelKey,
  variant = "outline",
  className,
  children,
}: {
  action: CustomerAction;
  successKey: string;
  labelKey: string;
  variant?: "outline" | "destructive" | "default";
  className?: string;
  children?: React.ReactNode;
}) {
  const labels = useLabels();
  // The toast fires from the action callback; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast.
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        startTransition(async () => {
          const result = await action(null, formData);
          if (result.error) toast.error(result.error);
          else toast.success(label(labelsRef.current, successKey));
        });
      }}
    >
      {children}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {label(labels, labelKey)}
      </Button>
    </form>
  );
}

export function BlockAccountButton({
  customerId,
  blocked,
}: {
  customerId: string;
  blocked: boolean;
}) {
  return (
    <ActionForm
      action={setCustomerBlockedAction}
      successKey={blocked ? "admin.customers.toast.unblocked" : "admin.customers.toast.blocked"}
      labelKey={blocked ? "admin.customers.action.unblock" : "admin.customers.action.block"}
      variant={blocked ? "default" : "destructive"}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="blocked" value={blocked ? "false" : "true"} />
    </ActionForm>
  );
}

export function CustomerNotesForm({
  customerId,
  notes,
}: {
  customerId: string;
  notes: string;
}) {
  const labels = useLabels();
  return (
    <ActionForm
      action={setCustomerNotesAction}
      successKey="admin.customers.toast.notesSaved"
      labelKey="admin.customers.notes.save"
      className="space-y-2"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <textarea
        name="notes"
        defaultValue={notes}
        rows={4}
        placeholder={label(labels, "admin.customers.notes.placeholder")}
        aria-label={label(labels, "admin.customers.notes.title")}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      />
    </ActionForm>
  );
}

export function ResetPasswordButton({ customerId }: { customerId: string }) {
  return (
    <ActionForm
      action={adminResetPasswordAction}
      successKey="admin.customers.toast.resetSent"
      labelKey="admin.customers.action.resetPassword"
    >
      <input type="hidden" name="customerId" value={customerId} />
    </ActionForm>
  );
}
