"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  type ChangePasswordActionState,
} from "@/server/actions/admin/account";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordActionState | null, FormData>(
    changePasswordAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Passwort geändert.");
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">Neues Passwort</Label>
          <Input
            id="next"
            name="next"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Neues Passwort bestätigen</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Passwort ändern
        </Button>
        {state && !state.ok && state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
