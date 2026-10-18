"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormatters } from "@/components/storefront/locale-formatters";
import { setDiscountCode, useCart } from "@/stores/cart";
import { validateDiscountAction } from "@/server/actions/discounts";

// Discount code field for cart and checkout (issue #45): "Einlösen" validates against
// the server with clear German feedback; the applied code shows its reduction and can
// be removed again. The server re-checks everything at order time regardless.
export function DiscountInput({
  subtotalCents,
  onDiscountChange,
}: {
  subtotalCents: number;
  onDiscountChange?: (discountCents: number) => void;
}) {
  const { chf } = useFormatters();
  const cart = useCart();
  const applied = cart.discountCode;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [appliedCents, setAppliedCents] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function redeem(rawCode: string): void {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await validateDiscountAction(trimmed, subtotalCents);
      if (!result.ok) {
        setError(result.error ?? "Dieser Gutscheincode ist ungültig.");
        return;
      }
      setDiscountCode(trimmed);
      setAppliedCents(result.discountCents ?? 0);
      setCode("");
      onDiscountChange?.(result.discountCents ?? 0);
    });
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-sm">
        <span className="flex min-w-0 items-center gap-1.5">
          <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate font-medium">{applied}</span>
          {appliedCents !== null && (
            <span className="shrink-0 text-muted-foreground">−{chf(appliedCents)}</span>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => {
            setDiscountCode(undefined);
            setAppliedCents(null);
            setError(null);
            onDiscountChange?.(0);
          }}
        >
          <X className="size-3" aria-hidden />
          Entfernen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Gutscheincode"
          aria-label="Gutscheincode"
          aria-invalid={error !== null}
          autoComplete="off"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || code.trim().length === 0}
          onClick={() => redeem(code)}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Einlösen
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
