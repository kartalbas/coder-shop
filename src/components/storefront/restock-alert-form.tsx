"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/components/labels";
import { interpolate, label } from "@/lib/i18n";
import { subscribeRestockAlertAction } from "@/server/actions/restock-alerts";

// "Benachrichtigen, wenn wieder verfügbar" for a sold-out variant (issue #46). The
// address is remembered locally so the form does not reappear after a subscription.
// Issue #58 step 3: every text comes from the translation table.
export function RestockAlertForm({ sku, productName }: { sku: string; productName: string }) {
  const labels = useLabels();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await subscribeRestockAlertAction(sku, email);
      if (!result.ok) {
        toast.error(result.error ?? label(labels, "shop.restock.errorToast"));
        return;
      }
      setSubscribed(true);
      toast.success(
        result.inStock
          ? label(labels, "shop.restock.inStockToast")
          : label(labels, "shop.restock.notifiedToast"),
      );
    });
  };

  if (subscribed) {
    return (
      <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm" role="status">
        <Bell className="mr-1.5 inline size-4 text-primary" aria-hidden />
        {interpolate(label(labels, "shop.restock.subscribed"), { email })}
      </p>
    );
  }

  return (
    <form
      className="space-y-2 rounded-md border bg-muted/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="text-sm font-medium">{label(labels, "shop.restock.title")}</p>
      <div className="flex gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ihre@email.ch"
          aria-label={interpolate(label(labels, "shop.restock.emailAria"), { name: productName })}
          autoComplete="email"
          className="h-9"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          {label(labels, "shop.restock.submit")}
        </Button>
      </div>
    </form>
  );
}
