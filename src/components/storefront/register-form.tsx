"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordRulesChecklist } from "@/components/password-rules-checklist";
import { passwordRulesMet } from "@/lib/password-rules";
import { label } from "@/lib/i18n";
import { useLabels } from "@/components/storefront/labels";
import {
  registerAction,
  type AccountActionState,
} from "@/server/actions/account";

// Issue #60: every field is controlled so a failed submit keeps what the user typed
// (React resets uncontrolled fields after a form action), the rules show live and the
// error sits at the field it belongs to.
export function RegisterForm() {
  const labels = useLabels();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    registerAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const passwordMet = passwordRulesMet("customer", password);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{label(labels, "shop.checkout.field.name")}</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Max Muster"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={state?.fieldErrors?.name !== undefined}
          aria-describedby={state?.fieldErrors?.name ? "name-error" : undefined}
        />
        {state?.fieldErrors?.name && (
          <p id="name-error" role="alert" className="text-sm text-destructive">
            {state.fieldErrors.name}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{label(labels, "shop.checkout.field.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="max@example.ch"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={state?.fieldErrors?.email !== undefined}
          aria-describedby={state?.fieldErrors?.email ? "email-error" : undefined}
        />
        {state?.fieldErrors?.email && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {state.fieldErrors.email}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{label(labels, "shop.auth.field.password")}</Label>
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
      <div className="flex items-start gap-2">
        <Checkbox
          id="consent"
          name="consent"
          className="mt-0.5"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
        />
        <Label htmlFor="consent" className="text-sm font-normal">
          {label(labels, "shop.auth.consent")}
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={pending || !passwordMet}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.action.register")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {label(labels, "shop.auth.hasAccount")}{" "}
        <Link
          href="/account/login"
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {label(labels, "shop.action.login")}
        </Link>
      </p>
    </form>
  );
}
