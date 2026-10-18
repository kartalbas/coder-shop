"use client";

import { Check, X } from "lucide-react";
import {
  MIN_PASSWORD_LENGTH,
  passwordRuleChecks,
  passwordRules,
  type PasswordScope,
} from "@/lib/password-rules";
import { interpolate, label } from "@/lib/i18n";
import { useLabels } from "@/components/labels";
import { cn } from "@/lib/utils";

// Issue #60: every form that sets a password shows the rules live while typing —
// each rule met or not, announced to screen readers as the state changes.
// Issue #58 step 3: the rule wording is translation-table text (`shop.password.rule.*`,
// {min} = MIN_PASSWORD_LENGTH); the rules themselves stay the pure lib source.
export function PasswordRulesChecklist({
  scope,
  password,
  id,
}: {
  scope: PasswordScope;
  password: string;
  id: string;
}) {
  const labels = useLabels();
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
            {interpolate(label(labels, `shop.password.rule.${rule.key}`), {
              min: MIN_PASSWORD_LENGTH,
            })}
            <span className="sr-only">
              {label(labels, checks[rule.key] ? "shop.password.met" : "shop.password.unmet")}
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">
        {label(labels, allMet ? "shop.password.allMet" : "shop.password.notAllMet")}
      </p>
    </div>
  );
}
