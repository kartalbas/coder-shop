"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordRulesChecklist } from "@/components/password-rules-checklist";
import { useLabels } from "@/components/labels";
import { label } from "@/lib/i18n";
import { passwordRulesMet } from "@/lib/password-rules";
import {
  changePasswordAction,
  type ChangePasswordActionState,
} from "@/server/actions/admin/account";

// Issue #60: controlled inputs keep the values through a failed submit; the new
// password shows its rules live and every error sits at its field.
export function PasswordForm() {
  const labels = useLabels();
  // The toast fires through a ref kept current by an effect so a label sync can never
  // re-fire it (address-book pattern).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, formAction, pending] = useActionState<ChangePasswordActionState | null, FormData>(
    changePasswordAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success(label(labelsRef.current, "admin.account.passwordChanged"));
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="current">Aktuelles Passwort</Label>
          <Input
            id="current"
            name="current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            aria-invalid={state?.fieldErrors?.current !== undefined}
          />
          {state?.fieldErrors?.current && (
            <p role="alert" className="text-sm text-destructive">
              {state.fieldErrors.current}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">Neues Passwort</Label>
          <Input
            id="next"
            name="next"
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-describedby="next-password-hints"
          />
          <PasswordRulesChecklist id="next-password-hints" scope="admin" password={next} />
          {state?.fieldErrors?.next && (
            <p role="alert" className="text-sm text-destructive">
              {state.fieldErrors.next}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Neues Passwort bestätigen</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={state?.fieldErrors?.confirm !== undefined}
          />
          {state?.fieldErrors?.confirm && (
            <p role="alert" className="text-sm text-destructive">
              {state.fieldErrors.confirm}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !passwordRulesMet("admin", next)}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Passwort ändern
        </Button>
      </div>
    </form>
  );
}
