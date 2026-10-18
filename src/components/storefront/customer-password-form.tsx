"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordRulesChecklist } from "@/components/password-rules-checklist";
import { passwordRulesMet } from "@/lib/password-rules";
import { label } from "@/lib/i18n";
import { useLabels } from "@/components/storefront/labels";
import {
  changePasswordAction,
  type ChangeOwnPasswordActionState,
} from "@/server/actions/account";

// Issue #60: controlled inputs keep the values through a failed submit; the new
// password shows its rules live and the error sits at the field it belongs to.
export function CustomerPasswordForm() {
  const labels = useLabels();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [state, formAction, pending] = useActionState<
    ChangeOwnPasswordActionState | null,
    FormData
  >(changePasswordAction, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{label(labels, "shop.account.currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          aria-invalid={state?.fieldErrors?.currentPassword !== undefined}
        />
        {state?.fieldErrors?.currentPassword && (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.currentPassword}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{label(labels, "shop.auth.newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          aria-describedby="new-password-hints"
        />
        <PasswordRulesChecklist id="new-password-hints" scope="customer" password={newPassword} />
        {state?.fieldErrors?.newPassword && (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.newPassword}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={pending || !passwordRulesMet("customer", newPassword)}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.account.changePassword")}
      </Button>
    </form>
  );
}
