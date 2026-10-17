"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordChecks } from "@/lib/validations/account";
import {
  registerAction,
  type AccountActionState,
} from "@/server/actions/account";
import { cn } from "@/lib/utils";

const STRENGTH_HINTS = [
  { key: "longEnough", label: "mindestens 10 Zeichen" },
  { key: "hasLetter", label: "ein Buchstabe" },
  { key: "hasDigit", label: "eine Zahl" },
] as const;

export function RegisterForm() {
  const [password, setPassword] = useState("");
  const checks = useMemo(() => passwordChecks(password), [password]);
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    registerAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name, Vorname</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Max Muster" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="max@example.ch"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
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
        <ul id="password-hints" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {STRENGTH_HINTS.map(({ key, label }) => (
            <li key={key} className={cn("flex items-center gap-1", checks[key] && "text-primary")}>
              {checks[key] ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <X className="size-3.5" aria-hidden />
              )}
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="consent" name="consent" className="mt-0.5" />
        <Label htmlFor="consent" className="text-sm font-normal">
          Ich akzeptiere die AGB und die Datenschutzerklärung (Demo).
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Konto erstellen
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Bereits ein Konto?{" "}
        <Link
          href="/konto/anmelden"
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Anmelden
        </Link>
      </p>
    </form>
  );
}
