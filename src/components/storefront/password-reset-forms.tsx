"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  passwordResetConfirmAction,
  passwordResetRequestAction,
  type AccountActionState,
} from "@/server/actions/account";

export function PasswordResetRequestForm() {
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
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="sie@beispiel.ch"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Link anfordern
      </Button>
      {state?.ok && state.message && (
        <p role="status" className="text-sm text-primary">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function PasswordResetConfirmForm({ token }: { token: string }) {
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
        <Label htmlFor="password">Neues Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
        />
        <p className="text-xs text-muted-foreground">
          Mindestens 10 Zeichen, ein Buchstabe und eine Zahl.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Passwort setzen
      </Button>
      {state?.ok && state.message && (
        <p role="status" className="text-sm text-primary">
          {state.message}
        </p>
      )}
    </form>
  );
}
