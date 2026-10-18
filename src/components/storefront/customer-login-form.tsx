"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { label } from "@/lib/i18n";
import { useLabels } from "@/components/storefront/labels";
import {
  customerLoginAction,
  type AccountActionState,
} from "@/server/actions/account";

export function CustomerLoginForm() {
  const labels = useLabels();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    customerLoginAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="email">{label(labels, "shop.checkout.field.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="sie@beispiel.ch"
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{label(labels, "shop.auth.field.password")}</Label>
          <Link
            href="/account/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {label(labels, "shop.auth.forgotLink")}
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "shop.action.login")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {label(labels, "shop.auth.noAccount")}{" "}
        <Link
          href="/account/register"
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {label(labels, "shop.auth.registerLink")}
        </Link>
      </p>
    </form>
  );
}
