"use client";

import { Check, X } from "lucide-react";
import { passwordRuleChecks, passwordRules, type PasswordScope } from "@/lib/password-rules";
import { cn } from "@/lib/utils";

// Issue #60: every form that sets a password shows the rules live while typing —
// each rule met or not, announced to screen readers as the state changes.
export function PasswordRulesChecklist({
  scope,
  password,
  id,
}: {
  scope: PasswordScope;
  password: string;
  id: string;
}) {
  const checks = passwordRuleChecks(scope, password);
  const allMet = passwordRules(scope).every((rule) => checks[rule.key]);
  return (
    <div id={id} aria-live="polite">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {passwordRules(scope).map((rule) => (
          <li
            key={rule.key}
            className={cn("flex items-center gap-1", checks[rule.key] && "text-primary")}
          >
            {checks[rule.key] ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            {rule.label}
            <span className="sr-only">{checks[rule.key] ? ", erfüllt" : ", noch nicht erfüllt"}</span>
          </li>
        ))}
      </ul>
      <p className="sr-only">
        {allMet
          ? "Alle Passwort-Anforderungen sind erfüllt."
          : "Die Passwort-Anforderungen sind noch nicht alle erfüllt."}
      </p>
    </div>
  );
}
