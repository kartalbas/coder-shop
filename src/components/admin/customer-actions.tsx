"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminResetPasswordAction,
  setCustomerBlockedAction,
  setCustomerNotesAction,
  type CustomerActionState,
} from "@/server/actions/admin/customers";

// Issue #43: block/unblock, internal notes and the admin-initiated password reset.
// Same toast-on-resolved-result pattern as the invoice actions.
type CustomerAction = (
  previous: CustomerActionState | null,
  formData: FormData,
) => Promise<CustomerActionState>;

function ActionForm({
  action,
  success,
  label,
  variant = "outline",
  className,
  children,
}: {
  action: CustomerAction;
  success: string;
  label: string;
  variant?: "outline" | "destructive" | "default";
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
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {label}
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
      success={blocked ? "Konto entsperrt." : "Konto gesperrt."}
      label={blocked ? "Entsperren" : "Sperren"}
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
  return (
    <ActionForm
      action={setCustomerNotesAction}
      success="Notiz gespeichert."
      label="Notiz speichern"
      className="space-y-2"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <textarea
        name="notes"
        defaultValue={notes}
        rows={4}
        placeholder="Interne Notizen zu diesem Konto …"
        aria-label="Interne Notiz"
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      />
    </ActionForm>
  );
}

export function ResetPasswordButton({ customerId }: { customerId: string }) {
  return (
    <ActionForm
      action={adminResetPasswordAction}
      success="Reset-Mail gesendet."
      label="Passwort zurücksetzen"
    >
      <input type="hidden" name="customerId" value={customerId} />
    </ActionForm>
  );
}
