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
import { useLabels } from "@/components/labels";
import {
  passwordResetConfirmAction,
  passwordResetRequestAction,
  type AccountActionState,
} from "@/server/actions/account";

export function PasswordResetRequestForm() {
  const labels = useLabels();
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    passwordResetRequestAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{label(labels, "shop.checkout.field.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="sie@beispiel.ch"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.auth.requestLink")}
      </Button>
      {state?.ok && state.message && (
        <p role="status" className="text-sm text-primary">
          {state.message}
        </p>
      )}
    </form>
  );
}

// Issue #60: controlled input (a failed submit keeps the value), live rules checklist,
// submit reflects the rules, error at the field.
export function PasswordResetConfirmForm({ token }: { token: string }) {
  const labels = useLabels();
  const [password, setPassword] = useState("");
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    passwordResetConfirmAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">{label(labels, "shop.auth.newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-hints"
        />
        <PasswordRulesChecklist id="password-hints" scope="customer" password={password} />
        {state?.fieldErrors?.password && (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.password}
          </p>
        )}
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || !passwordRulesMet("customer", password)}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.auth.setPassword")}
      </Button>
      {state?.ok && state.message && (
        <p role="status" className="text-sm text-primary">
          {state.message}
        </p>
      )}
    </form>
  );
}
